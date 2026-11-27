import type { ControlHost } from '../../electron/control/dispatcher'
import type { ControlVerse } from '../../shared/control/schema'
import { verseToText } from '../../shared/scriptureText'
import { pickThemeSlide, type ProClient, type ProId } from './client'

/**
 * ProPresenter as a ControlHost, through its API instead of its buttons.
 *
 * The same five abilities a taught recipe answers (controller/recipes/host.ts),
 * answered by ProPresenter itself:
 *
 * - a verse: Trilorah resolves the text from its own Bible, stages it in its
 *   own preview as always, and on take sends reference + text into a
 *   ProPresenter *Message* (a text overlay with tokens). ProPresenter's API
 *   has no Bible search, and a message is the one thing it lets us put on
 *   screen with words we chose. The message is created once, on first take,
 *   on the Scripture theme ProPresenter ships; the church can restyle it.
 * - a song: looked up by title in ProPresenter's library and triggered from
 *   its first slide, so the words on the wall are the church's own arrangement.
 * - clear: the message and slide layers, never audio or media.
 * - next / previous: ProPresenter's own triggers.
 *
 * Nothing runs by itself: a detection stages and waits; only a press (CLI,
 * console, remote) sends live.take here. ControlHost is synchronous and the
 * API is not, so the async work is kicked off and the synchronous answer is
 * what was asked for; a failure surfaces through onProblem and the next
 * snapshot, as the recipe host does.
 */
export const SCRIPTURE_MESSAGE_NAME = 'Trilorah Scripture'
export const DEFAULT_LIBRARY = 'Default'

export interface ProPresenterHostOptions {
  client: ProClient
  /** Trilorah's own host: resolves the verse text, and keeps listening and the screen states. */
  own: ControlHost
  /** Which library songs are looked up in; ProPresenter's first one is "Default". */
  library?: string
  onProblem?: (ability: string, problem: string) => void
}

/** "John 3:16-17 (WEB)" from a ControlVerse, or the raw words when there is no parsed reference. */
export function referenceLine(v: ControlVerse): string {
  if (!v.chapter) return v.book
  const range = v.endVerse && v.endVerse !== v.verse ? `${v.verse}-${v.endVerse}` : String(v.verse)
  return `${v.book} ${v.chapter}:${range}${v.version ? ` (${v.version})` : ''}`
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** The library item a title means: exact first, then one that starts with it, then one that contains it — or nothing, never a guess between two. */
export function matchPresentation(items: ProId[], title: string): ProId | null | 'ambiguous' {
  const want = norm(title)
  if (!want) return null
  const exact = items.filter((i) => norm(i.name) === want)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return 'ambiguous'
  const starts = items.filter((i) => norm(i.name).startsWith(want))
  if (starts.length === 1) return starts[0]
  if (starts.length > 1) return 'ambiguous'
  const within = items.filter((i) => norm(i.name).includes(want))
  if (within.length === 1) return within[0]
  return within.length > 1 ? 'ambiguous' : null
}

export function proPresenterHost(opts: ProPresenterHostOptions): ControlHost {
  const { client, own } = opts
  const library = opts.library ?? DEFAULT_LIBRARY
  let staged: ControlVerse | null = null
  let stagedSong: ProId | null = null
  let live: ControlVerse | null = null
  let messageUuid: string | null = null

  const problem = (ability: string, e: unknown): string => {
    const words = e instanceof Error ? e.message : String(e)
    opts.onProblem?.(ability, words)
    return words
  }

  /** The scripture message's UUID, creating the message the first time. */
  async function scriptureMessage(): Promise<string> {
    if (messageUuid) return messageUuid
    const existing = (await client.messages()).find((m) => m.id.name === SCRIPTURE_MESSAGE_NAME)
    if (existing) return (messageUuid = existing.id.uuid)
    const theme = pickThemeSlide(await client.themes(), /scripture/i)
    if (!theme) throw new Error('ProPresenter has no theme to put a verse on — add one under Theme')
    const made = await client.createMessage({
      id: { name: SCRIPTURE_MESSAGE_NAME },
      message: '{reference}\n{text}',
      tokens: [{ name: 'reference', text: { text: '' } }, { name: 'text', text: { text: '' } }],
      theme,
      visible_on_network: false,
      is_active: false,
    })
    return (messageUuid = made.id.uuid)
  }

  async function showVerse(v: ControlVerse): Promise<void> {
    const uuid = await scriptureMessage()
    await client.triggerMessage(uuid, [
      { name: 'reference', text: { text: referenceLine(v) } },
      // The wall's plain text: KJV's {supplied} words kept, its {lemma: note} apparatus dropped.
      { name: 'text', text: { text: verseToText(v.text) } },
    ])
  }

  return {
    listening: () => own.listening(),
    startListening: (device) => own.startListening(device),
    stopListening: () => own.stopListening(),

    stageScripture: (reference, version) => {
      // Trilorah's own Bible gives the words; ProPresenter only gets to show them.
      const verse = own.stageScripture(reference, version)
      if (!verse) return null
      staged = verse
      stagedSong = null
      return staged
    },

    stageSong: (title) => {
      staged = { book: title, chapter: 0, verse: 0, version: 'ProPresenter', text: '' }
      stagedSong = null
      const asked = staged
      void client.library(library).then((items) => {
        const hit = matchPresentation(items, title)
        if (hit === 'ambiguous') throw new Error(`more than one presentation in ProPresenter's ${library} library is called something like "${title}" — say more of the name`)
        if (!hit) throw new Error(`no presentation called "${title}" in ProPresenter's ${library} library`)
        if (staged === asked) { stagedSong = hit; staged = { ...asked, book: hit.name } }
      }).catch((e) => { problem('findSong', e); if (staged === asked) staged = null })
      return { staged }
    },

    take: () => {
      if (!staged) return null
      const taking = staged
      const song = stagedSong
      const work = song ? client.triggerCue(library, song.uuid, 0) : showVerse(taking)
      void work.then(() => { live = taking }).catch((e) => problem('show', e))
      return taking
    },

    clearLive: () => {
      void Promise.all([client.clearLayer('messages'), client.clearLayer('slide')])
        .then(() => { live = null })
        .catch((e) => problem('clear', e))
    },
    next: () => { void client.next().catch((e) => problem('next', e)) },
    previous: () => { void client.previous().catch((e) => problem('previous', e)) },

    setScreen: (state) => own.setScreen(state),
    toggleScreen: (state) => own.toggleScreen(state),
    screen: () => own.screen(),
    preview: () => staged,
    live: () => live,
    openConsole: () => own.openConsole(),
  }
}
