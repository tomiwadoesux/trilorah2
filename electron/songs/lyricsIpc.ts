import { discoverChristianSongs } from './songDiscovery';
/**
 * IPC for the two online lyric sources. Kept out of main.ts because neither
 * touches app state — no store, no windows — so there is nothing here that
 * needs main's closures, and main.ts is long enough.
 *
 * Every handler resolves to a typed `{ ok }` result. The functions behind
 * them already catch their own failures; the catch here is the backstop that
 * keeps the promise — a rejection crossing IPC arrives in the renderer as
 * "Error invoking remote method…", which is not something to show an
 * operator on a Sunday.
 */

import type { IpcMain } from 'electron'
import { getLyrics, searchLyrics } from './lyricsSearch'
import { youtubeCaptions } from './youtubeCaptions'

const backstop = (err: unknown) => ({
  ok: false as const,
  reason: 'error' as const,
  message: (err as Error)?.message ?? 'Something went wrong.'
})

export function registerLyricsIpc(ipcMain: IpcMain): void {
  ipcMain.handle('songs-discover', (_event, payload: { query?: string } | undefined) => discoverChristianSongs(String(payload?.query ?? '')));
  ipcMain.handle('lyrics-search', (_event, payload: { query?: string } | undefined) =>
    searchLyrics(String(payload?.query ?? '')).catch(backstop)
  )
  ipcMain.handle('lyrics-get', (_event, payload: { id?: number } | undefined) =>
    getLyrics(Number(payload?.id)).catch(backstop)
  )
  ipcMain.handle('youtube-captions', (_event, payload: { url?: string } | undefined) =>
    youtubeCaptions(String(payload?.url ?? '')).catch(backstop)
  )
}
