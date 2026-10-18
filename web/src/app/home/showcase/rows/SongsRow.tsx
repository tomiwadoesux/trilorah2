import { ShowcaseRow, ShowcaseShot } from '../ShowcaseRow';
import './songs-row.css';

/*
 * Row 2 · #songs. Both panels are native captures from the real app
 * (scripts/capture-showcase.mjs). The story keeps the owner's rule: song search
 * found Amazing Grace and verse 1 went live on a press; verse 2 now waits in
 * preview beside go live, and nothing reaches the wall until someone presses.
 * Row 1 puts the crisp panel on the left; this row mirrors it to the right.
 *
 * Features, checked in the app's code:
 * - Song search by listening: the "search song" button in src/design/screens/Live.tsx (setActive + engine.listen)
 *   matches the last words heard (recentSongWords) against the library's lyrics (matchSongs in
 *   src/lib/songMatch.ts); results show in SongResults, src/design/screens/CatchesPane.tsx. A click there
 *   stages the song in preview; only its "live" button sends it.
 * - Lyrics paged to fit the screen: shared/songCards.ts (four-line pages per section), shared/lyricSplit.ts
 *   (lyrics cut into projector-sized slides), and the wall's shrink-to-fit (src/lib/useFitText, used by
 *   src/design/screens/slide.tsx).
 * - Slides and decks: quick slides and PowerPoint/ODP import in src/design/screens/presentations.tsx;
 *   electron/media/pptxConverter.ts converts a deck through LibreOffice + Poppler on the machine.
 * - Pictures and videos as backgrounds: src/lib/backgroundDrop.ts and BackgroundVideo in src/output.tsx.
 */
export function SongsRow() {
  return (
    <ShowcaseRow
      id="songs"
      title="Every song, every slide."
      subtitle="Ready on cue."
      lead="Search a song by what the room is singing."
      detail="Page through the lyrics verse by verse, and send pictures and slides from the same place."
      features={['Song search by listening', 'Lyrics paged to fit the screen', 'Slides and decks', 'Pictures and videos as backgrounds']}
      learnMore={{ href: '/guide/songs.create-edit-slides', label: 'Create or edit lyric slides' }}
      caption="Song search finds Amazing Grace from the words being sung. The selected lyric card waits in preview until Go live is pressed, then appears on the live screen."
      back={<ShowcaseShot src="/showcase/songs-workspace.webp" width={2570} height={1102} />}
      front={<ShowcaseShot src="/showcase/songs-catches.webp" width={1050} height={684} />}
    />
  );
}
