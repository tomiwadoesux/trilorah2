/**
 * What is on the projector that is not a Bible verse.
 *
 * Verses have had a wire from the app to the output windows since the first
 * build (`on-verse-detected`). Songs never did: pressing "go live" on a song
 * section moved it from the preview box to the live box INSIDE the app and
 * told nobody else, so the operator's screen said a chorus was up while the
 * congregation looked at whatever was there before. This is the payload for
 * the wire that fixes that.
 *
 * Deliberately small. Pictures — imported slides, media — already travel on
 * `show-media` as a file path, and the output window paints them full-bleed;
 * a second channel for the same pixels would be two paths that can disagree
 * about what is on the wall. So this carries only what has no path: words.
 *
 * Shared by main (which remembers it, so a projector window opened
 * mid-service shows what is live), the app (which sends it) and the output
 * window (which draws it). No imports, so all three agree.
 */

export interface LiveSong {
  kind: 'song'
  title: string
  /** The section — "Verse 2", "Chorus". Drawn small, under the words. */
  label: string
  /** One slide's worth of lines. The app decides the split; the projector
   *  draws what it is handed and breaks nothing further. */
  lines: string[]
}

export type LiveContent = LiveSong
