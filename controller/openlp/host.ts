import type { ControlHost } from '../../electron/control/dispatcher'
import type { ControlVerse } from '../../shared/control/schema'
import { matchPresentation } from '../propresenter/host'
import type { OpenLpClient } from './client'

/**
 * OpenLP as a ControlHost, through its API instead of its buttons.
 *
 * - a verse: OpenLP's own Bible search finds it ("John 3:16" → its reference
 *   and text); staging keeps the hit, take puts it live. The text shown is
 *   OpenLP's, from the Bible the church installed there, and that is what the
 *   preview carries — not Trilorah's copy of the verse.
 * - a song: OpenLP's song search, matched on title the way ProPresenter's is;
 *   take puts it live from its first slide.
 * - clear: blank (black) through the display control; the next take shows again.
 * - next / previous: the live item's slides.
 *
 * Same contract as the ProPresenter host: synchronous answers, async work,
 * failures through onProblem and the next snapshot, and nothing goes live
 * without a take.
 */
export interface OpenLpHostOptions {
  client: OpenLpClient
  own: ControlHost
  onProblem?: (ability: string, problem: string) => void
}

export function openLpHost(opts: OpenLpHostOptions): ControlHost {
  const { client, own } = opts
  let staged: ControlVerse | null = null
  let stagedId: { kind: 'bible'; id: string } | { kind: 'song'; id: number } | null = null
  let live: ControlVerse | null = null

  const problem = (ability: string, e: unknown): string => {
    const words = e instanceof Error ? e.message : String(e)
    opts.onProblem?.(ability, words)
    return words
  }

  return {
    listening: () => own.listening(),
    startListening: (device) => own.startListening(device),
    stopListening: () => own.stopListening(),

    stageScripture: (reference) => {
      staged = { book: reference, chapter: 0, verse: 0, version: 'OpenLP', text: '' }
      stagedId = null
      const asked = staged
      void client.searchBibles(reference).then((hits) => {
        const hit = hits[0]
        if (!hit) throw new Error(`OpenLP's Bible has nothing for "${reference}"`)
        if (staged === asked) { stagedId = { kind: 'bible', id: hit[0] }; staged = { ...asked, book: hit[0], text: hit[1] } }
      }).catch((e) => { problem('findVerse', e); if (staged === asked) staged = null })
      return staged
    },

    stageSong: (title) => {
      staged = { book: title, chapter: 0, verse: 0, version: 'OpenLP', text: '' }
      stagedId = null
      const asked = staged
      void client.searchSongs(title).then((hits) => {
        const items = hits.map(([id, name], index) => ({ uuid: String(id), name, index }))
        const hit = matchPresentation(items, title)
        if (hit === 'ambiguous') throw new Error(`more than one song in OpenLP is called something like "${title}" — say more of the name`)
        if (!hit) throw new Error(`no song called "${title}" in OpenLP`)
        if (staged === asked) { stagedId = { kind: 'song', id: Number(hit.uuid) }; staged = { ...asked, book: hit.name } }
      }).catch((e) => { problem('findSong', e); if (staged === asked) staged = null })
      return { staged }
    },

    take: () => {
      if (!staged || !stagedId) return null
      const taking = staged
      const work = stagedId.kind === 'song' ? client.songLive(stagedId.id) : client.bibleLive(stagedId.id)
      void work.then(() => client.display('show').catch(() => undefined)).then(() => { live = taking }).catch((e) => problem('show', e))
      return taking
    },

    clearLive: () => { void client.display('blank').then(() => { live = null }).catch((e) => problem('clear', e)) },
    next: () => { void client.progress('next').catch((e) => problem('next', e)) },
    previous: () => { void client.progress('previous').catch((e) => problem('previous', e)) },

    setScreen: (state) => own.setScreen(state),
    toggleScreen: (state) => own.toggleScreen(state),
    screen: () => own.screen(),
    preview: () => staged,
    live: () => live,
    openConsole: () => own.openConsole(),
  }
}
