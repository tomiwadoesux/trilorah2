/**
 * YouTube caption/transcript extractor and lyric auto-divider.
 *
 * Given a YouTube video URL or ID, fetches the video title and subtitle tracks
 * using YouTube's innertube API, cleans the lyrics, and segments them into
 * verse/chorus stanzas ready for the Trilorah song editor.
 */

import type { ImportedSong, SongSection } from './import'

const INNERTUBE_CLIENT_VERSION = '20.10.38'
const INNERTUBE_CONTEXT = {
  client: {
    clientName: 'ANDROID',
    clientVersion: INNERTUBE_CLIENT_VERSION
  }
}
const INNERTUBE_USER_AGENT = `com.google.android.youtube/${INNERTUBE_CLIENT_VERSION} (Linux; U; Android 14)`
const FETCH_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)'

export function extractYoutubeId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim()
  if (/^[0-9A-Za-z_-]{11}$/.test(trimmed)) return trimmed
  const match = trimmed.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i
  )
  return match ? match[1] : null
}

export async function fetchYoutubeLyrics(
  urlOrId: string
): Promise<{ success: boolean; song?: ImportedSong; error?: string }> {
  const videoId = extractYoutubeId(urlOrId)
  if (!videoId) {
    return { success: false, error: 'Invalid YouTube URL or video ID' }
  }

  try {
    const resp = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': INNERTUBE_USER_AGENT
      },
      body: JSON.stringify({
        context: INNERTUBE_CONTEXT,
        videoId
      })
    })

    if (!resp.ok) {
      return { success: false, error: `YouTube responded with status ${resp.status}` }
    }

    const data = (await resp.json()) as any
    const title = (data?.videoDetails?.title ?? 'YouTube Song')
      .replace(/\s*\(?(?:official\s*(?:video|audio|lyrics?)|lyric\s*video|audio|video)\)?/gi, '')
      .trim()
    const author = data?.videoDetails?.author ?? ''

    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks
    if (!Array.isArray(tracks) || tracks.length === 0 || !tracks[0]?.baseUrl) {
      return {
        success: false,
        error:
          'No captions or transcript found for this video. You can paste the lyrics manually below.'
      }
    }

    // Pick English or default first track
    const track = tracks.find((t: any) => t.languageCode?.startsWith('en')) ?? tracks[0]
    const trackResp = await fetch(track.baseUrl, {
      headers: { 'User-Agent': FETCH_USER_AGENT }
    })

    if (!trackResp.ok) {
      return { success: false, error: 'Could not download the subtitle track from YouTube' }
    }

    const xml = await trackResp.text()
    if (!xml || xml.length === 0) {
      return { success: false, error: 'Empty transcript received from YouTube' }
    }

    // Parse caption text from XML
    const rawLines: string[] = []
    // Match <p ...> or <text ...>
    const pMatches = [...xml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    if (pMatches.length > 0) {
      for (const m of pMatches) {
        const cleaned = m[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\[[^\]]*\]/g, '') // remove [Music], [Applause]
          .replace(/\s+/g, ' ')
          .trim()
        if (cleaned) rawLines.push(cleaned)
      }
    } else {
      const textMatches = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)]
      for (const m of textMatches) {
        const cleaned = m[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\[[^\]]*\]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        if (cleaned) rawLines.push(cleaned)
      }
    }

    if (rawLines.length === 0) {
      return {
        success: false,
        error: 'No readable speech lines found in the video transcript'
      }
    }

    // Deduplicate consecutive identical lines (often in auto-captions)
    const deduped: string[] = []
    for (const line of rawLines) {
      if (deduped.length === 0 || deduped[deduped.length - 1].toLowerCase() !== line.toLowerCase()) {
        deduped.push(line)
      }
    }

    // Group lines into stanzas (sections of ~4 lines each for slide-friendly reading)
    const sections: SongSection[] = []
    const CHUNK_SIZE = 4
    let sectionIdx = 1

    for (let i = 0; i < deduped.length; i += CHUNK_SIZE) {
      const chunk = deduped.slice(i, i + CHUNK_SIZE)
      sections.push({
        label: `Verse ${sectionIdx++}`,
        lines: chunk
      })
    }

    return {
      success: true,
      song: {
        title,
        authors: author ? [author] : undefined,
        sections
      }
    }
  } catch (err: any) {
    console.error('❌ fetchYoutubeLyrics error:', err)
    return { success: false, error: err?.message ?? 'Failed to fetch YouTube transcript' }
  }
}
