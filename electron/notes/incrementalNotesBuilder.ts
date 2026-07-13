export interface IncrementalNotes {
  title?: string
  theme?: string
  currentPoints: Array<{ heading: string; explanation: string; scriptures: string[] }>
  definitions: Array<{ term: string; definition: string }>
  quotes: string[]
  applications: string[]
  summary?: string
}

/** The type+content format matches what SlowPathOrchestrator dispatches. */
export interface NotesUpdate {
  type: string
  content: string
}

export class IncrementalNotesBuilder {
  notes: IncrementalNotes
  onChange?: (notes: IncrementalNotes) => void

  constructor(onChange?: (notes: IncrementalNotes) => void) {
    this.notes = {
      currentPoints: [],
      definitions: [],
      quotes: [],
      applications: []
    }
    this.onChange = onChange
  }

  /**
   * Set the sermon title (usually detected from the opening).
   */
  setTitle(title: string) {
    this.notes.title = title
    this.emit()
  }

  /**
   * Set the sermon theme/topic.
   */
  setTheme(theme: string) {
    this.notes.theme = theme
    this.emit()
  }

  /**
   * Add or update a sermon point. If heading matches an existing point,
   * it merges the explanation and scriptures. Otherwise appends new.
   */
  addPoint(heading: string, explanation?: string, scriptures?: string[]) {
    const existing = this.notes.currentPoints.find(
      (p) => p.heading.toLowerCase() === heading.toLowerCase()
    )
    if (existing) {
      if (explanation) {
        existing.explanation = existing.explanation ? existing.explanation + ' ' + explanation : explanation
      }
      if (scriptures) {
        for (const ref of scriptures) {
          if (!existing.scriptures.includes(ref)) {
            existing.scriptures.push(ref)
          }
        }
      }
    } else {
      this.notes.currentPoints.push({
        heading,
        explanation: explanation || '',
        scriptures: scriptures || []
      })
    }
    this.emit()
  }

  /**
   * Add a key term definition.
   */
  addDefinition(term: string, definition: string) {
    const existing = this.notes.definitions.find(
      (d) => d.term.toLowerCase() === term.toLowerCase()
    )
    if (existing) {
      existing.definition = definition
    } else {
      this.notes.definitions.push({ term, definition })
    }
    this.emit()
  }

  /**
   * Add a notable quote from the sermon.
   */
  addQuote(quote: string) {
    if (!this.notes.quotes.includes(quote)) {
      this.notes.quotes.push(quote)
      this.emit()
    }
  }

  /**
   * Add a practical application.
   */
  addApplication(application: string) {
    if (!this.notes.applications.includes(application)) {
      this.notes.applications.push(application)
      this.emit()
    }
  }

  /**
   * Process a notes update from the reasoning loop.
   * The type+content format matches what SlowPathOrchestrator dispatches.
   */
  processUpdate(update: NotesUpdate) {
    try {
      switch (update.type) {
        case 'title':
          this.setTitle(update.content)
          break
        case 'theme':
          this.setTheme(update.content)
          break
        case 'point': {
          const parsed = JSON.parse(update.content)
          this.addPoint(parsed.heading, parsed.explanation, parsed.scriptures)
          break
        }
        case 'definition': {
          const parsed = JSON.parse(update.content)
          this.addDefinition(parsed.term, parsed.definition)
          break
        }
        case 'quote':
          this.addQuote(update.content)
          break
        case 'application':
          this.addApplication(update.content)
          break
        default:
          console.warn(
            `📝 IncrementalNotesBuilder: unknown update type "${update.type}"`
          )
      }
    } catch (e) {
      console.error('📝 IncrementalNotesBuilder: failed to process update:', e)
    }
  }

  /**
   * Get the current state of notes.
   */
  getCurrentNotes(): IncrementalNotes {
    return { ...this.notes }
  }

  /**
   * Finalize notes — return a complete snapshot for export/saving.
   */
  finalize(): IncrementalNotes {
    return {
      ...this.notes,
      summary: this.notes.summary || ''
    }
  }

  /**
   * Reset for a new service.
   */
  reset() {
    this.notes = {
      currentPoints: [],
      definitions: [],
      quotes: [],
      applications: []
    }
  }

  private emit() {
    this.onChange?.(this.getCurrentNotes())
  }
}
