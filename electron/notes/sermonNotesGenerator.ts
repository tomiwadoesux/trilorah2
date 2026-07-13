import * as fs from 'node:fs'
// @ts-ignore -- pdfkit ships no type declarations (@types/pdfkit not installed)
import PDFDocument from 'pdfkit'
import { getSetting } from '../data/settings'

export interface GeneratedSermonNotes {
  title: string
  theme: string
  mainPoints: Array<{ heading: string; explanation: string; scriptures: string[] }>
  definitions: Array<{ term: string; definition: string }>
  applications: string[]
  quotes: string[]
  summary: string
}

const SYSTEM_PROMPT = `You are a sermon notes assistant. Given a transcript of a sermon, extract structured notes in JSON format.
Return ONLY valid JSON matching this structure:
{
  "title": "sermon title based on content",
  "theme": "main theme/topic",
  "mainPoints": [
    {
      "heading": "point heading",
      "explanation": "brief explanation",
      "scriptures": ["Genesis 1:1", "John 3:16"]
    }
  ],
  "definitions": [
    {
      "term": "key term used",
      "definition": "what it means in context"
    }
  ],
  "applications": ["practical application 1", "practical application 2"],
  "quotes": ["notable quotes from the sermon"],
  "summary": "2-3 sentence summary of the sermon"
}`

export async function generateSermonNotes(transcript: string): Promise<GeneratedSermonNotes> {
  const hfToken = process.env.HF_API_TOKEN || getSetting('hfToken')
  if (!hfToken) {
    console.error('❌ No HuggingFace token found. Set HF_API_TOKEN in .env.local or add it in Settings.')
    throw new Error(
      'HuggingFace token not configured. Set HF_API_TOKEN in .env.local or add it in Settings.'
    )
  }
  if (!transcript || transcript.trim().length < 50) {
    throw new Error(
      'Not enough sermon transcript to generate notes. Keep listening during the sermon.'
    )
  }
  const maxChars = 6e3
  const truncated = transcript.length > maxChars ? transcript.slice(0, maxChars) + '...' : transcript
  const prompt = `${SYSTEM_PROMPT}

Sermon Transcript:
${truncated}

JSON Notes:`
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3.1-8B-Instruct',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 1500,
            temperature: 0.3,
            return_full_text: false
          }
        })
      }
    )
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HuggingFace API error (${response.status}): ${errorText}`)
    }
    const data: any = await response.json()
    const generatedText = Array.isArray(data) && data[0]?.generated_text ? data[0].generated_text : typeof data === 'string' ? data : JSON.stringify(data)
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse structured notes from model response')
    }
    const notes = JSON.parse(jsonMatch[0])
    if (!notes.title) notes.title = 'Untitled Sermon'
    if (!notes.theme) notes.theme = ''
    if (!notes.mainPoints) notes.mainPoints = []
    if (!notes.definitions) notes.definitions = []
    if (!notes.applications) notes.applications = []
    if (!notes.quotes) notes.quotes = []
    if (!notes.summary) notes.summary = ''
    return notes
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        'Failed to parse sermon notes. The model returned invalid JSON.'
      )
    }
    throw error
  }
}

export async function exportSermonNotesPdf(notes: GeneratedSermonNotes, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
      })
      const stream = fs.createWriteStream(outputPath)
      doc.pipe(stream)
      doc.fontSize(24).font('Helvetica-Bold').text(notes.title || 'Sermon Notes', { align: 'center' })
      if (notes.theme) {
        doc.moveDown(0.3)
        doc.fontSize(12).font('Helvetica').fillColor('#666666').text(notes.theme, { align: 'center' })
      }
      doc.moveDown(0.5)
      doc.strokeColor('#cccccc').lineWidth(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown(0.5)
      if (notes.summary) {
        doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold').text('SUMMARY')
        doc.moveDown(0.3)
        doc.fontSize(11).font('Helvetica').fillColor('#333333').text(notes.summary)
        doc.moveDown(1)
      }
      if (notes.mainPoints.length > 0) {
        doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold').text('MAIN POINTS')
        doc.moveDown(0.3)
        notes.mainPoints.forEach((point, i) => {
          doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000').text(`${i + 1}. ${point.heading}`)
          if (point.explanation) {
            doc.moveDown(0.2)
            doc.fontSize(11).font('Helvetica').fillColor('#333333').text(point.explanation, { indent: 15 })
          }
          if (point.scriptures.length > 0) {
            doc.moveDown(0.2)
            doc.fontSize(10).font('Helvetica-Oblique').fillColor('#2c5f2d').text(`Scriptures: ${point.scriptures.join(', ')}`, {
              indent: 15
            })
          }
          doc.moveDown(0.5)
        })
      }
      if (notes.definitions.length > 0) {
        doc.moveDown(0.5)
        doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold').text('KEY TERMS')
        doc.moveDown(0.3)
        notes.definitions.forEach((def) => {
          doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text(def.term, { continued: true }).font('Helvetica').fillColor('#333333').text(` — ${def.definition}`)
          doc.moveDown(0.3)
        })
      }
      if (notes.applications.length > 0) {
        doc.moveDown(0.5)
        doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold').text('APPLICATIONS')
        doc.moveDown(0.3)
        notes.applications.forEach((app) => {
          doc.fontSize(11).font('Helvetica').fillColor('#333333').text(`• ${app}`)
          doc.moveDown(0.2)
        })
      }
      if (notes.quotes.length > 0) {
        doc.moveDown(0.5)
        doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold').text('NOTABLE QUOTES')
        doc.moveDown(0.3)
        notes.quotes.forEach((quote) => {
          doc.fontSize(11).font('Helvetica-Oblique').fillColor('#555555').text(`"${quote}"`, { indent: 20 })
          doc.moveDown(0.3)
        })
      }
      doc.moveDown(1)
      doc.fontSize(8).font('Helvetica').fillColor('#999999').text(
        `Generated by Trilorah — ${new Date().toLocaleDateString()}`,
        { align: 'center' }
      )
      doc.end()
      stream.on('finish', resolve)
      stream.on('error', reject)
    } catch (error) {
      reject(error)
    }
  })
}

export function exportSermonNotesMarkdown(notes: GeneratedSermonNotes, outputPath: string) {
  const lines: string[] = []
  lines.push(`# ${notes.title || 'Sermon Notes'}`)
  if (notes.theme) {
    lines.push(`*Theme: ${notes.theme}*`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  if (notes.summary) {
    lines.push('## Summary')
    lines.push('')
    lines.push(notes.summary)
    lines.push('')
  }
  if (notes.mainPoints.length > 0) {
    lines.push('## Main Points')
    lines.push('')
    notes.mainPoints.forEach((point, i) => {
      lines.push(`### ${i + 1}. ${point.heading}`)
      lines.push('')
      if (point.explanation) {
        lines.push(point.explanation)
        lines.push('')
      }
      if (point.scriptures.length > 0) {
        lines.push(
          `> **Scriptures:** ${point.scriptures.join(', ')}`
        )
        lines.push('')
      }
    })
  }
  if (notes.definitions.length > 0) {
    lines.push('## Key Terms')
    lines.push('')
    notes.definitions.forEach((def) => {
      lines.push(`- **${def.term}** — ${def.definition}`)
    })
    lines.push('')
  }
  if (notes.applications.length > 0) {
    lines.push('## Applications')
    lines.push('')
    notes.applications.forEach((app) => {
      lines.push(`- ${app}`)
    })
    lines.push('')
  }
  if (notes.quotes.length > 0) {
    lines.push('## Notable Quotes')
    lines.push('')
    notes.quotes.forEach((quote) => {
      lines.push(`> "${quote}"`)
      lines.push('')
    })
  }
  lines.push('---')
  lines.push(
    `*Generated by Trilorah — ${new Date().toLocaleDateString()}*`
  )
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8')
}
