import type { ControlSongMatch } from '../../shared/control/schema'
import type { RunSegment } from '../../shared/operatorRun'
import { scheduledSongs } from '../../shared/scheduledSongs'
import { ASKED_BAR, matchSongs, type MatchableSong } from '../../shared/songMatch'

/**
 * The "♪ song" press, as the command layer sees it: the last words heard,
 * matched against the church's own library, with today's run of service
 * weighing in. Pure — main.ts supplies the words, the library and the run.
 *
 * The boost is a reorder, never a resurrection: a song that did not clear
 * the match bar (shared/songMatch ASKED_BAR) stays out however scheduled it
 * is, because "it is on the plan" is not evidence that these words are its
 * line. Among songs that did clear it, the plan wins: a pastor calling a
 * song almost always calls one the band rehearsed.
 */
const SCHEDULE_BOOST = 0.4

export function searchSongsLive(
  heard: string,
  library: readonly MatchableSong[],
  segments: readonly Pick<RunSegment, 'label' | 'items'>[]
): ControlSongMatch[] {
  const onPlan = new Set(
    scheduledSongs(library.map((s) => ({ id: s.id, title: s.title })), segments)
      .flatMap((entry) => (entry.song ? [entry.song.id] : []))
  )
  return matchSongs(heard, library, ASKED_BAR)
    .map((m) => ({
      id: m.song.id,
      title: m.song.title,
      section: m.label,
      score: m.score,
      ...(onPlan.has(m.song.id) ? { scheduled: true as const } : {}),
    }))
    .sort((a, b) => (b.score + (b.scheduled ? SCHEDULE_BOOST : 0)) - (a.score + (a.scheduled ? SCHEDULE_BOOST : 0)))
}

/**
 * The rolling tail the engine keeps for this: the last few finalized lines
 * plus the line still forming, trimmed to the newest words — what the
 * matcher's own window (songMatch slices to 14) can actually use.
 */
export function tailWords(finals: readonly string[], partial: string, keep = 14): string {
  return [...finals, partial].join(' ').trim().split(/\s+/).filter(Boolean).slice(-keep).join(' ')
}
