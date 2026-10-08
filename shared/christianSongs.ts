import { CHRISTIAN_SONG_ARTWORK } from './christianSongArtwork';

/** Reviewed song/artist pairs; discovery never samples the general music catalogue. */
export const CHRISTIAN_SONGS = [
  ['Goodness of God', 'CeCe Winans', 'gospel'],
  ['Way Maker', 'Sinach', 'worship'],
  ['Great Are You Lord', 'All Sons & Daughters', 'worship'],
  ['How Great Is Our God', 'Chris Tomlin', 'worship'],
  ['10,000 Reasons (Bless the Lord)', 'Matt Redman', 'worship'],
  ['What a Beautiful Name', 'Hillsong Worship', 'worship'],
  ['Oceans (Where Feet May Fail)', 'Hillsong UNITED', 'worship'],
  ['Living Hope', 'Phil Wickham', 'worship'],
  ['Firm Foundation (He Won’t)', 'Cody Carnes', 'worship'],
  ['Holy Forever', 'Chris Tomlin', 'worship'],
  ['Jireh', 'Elevation Worship', 'worship'],
  ['Gratitude', 'Brandon Lake', 'worship'],
  ['I Speak Jesus', 'Charity Gayle', 'worship'],
  ['In Christ Alone', 'Keith & Kristyn Getty', 'hymn'],
  ['Amazing Grace (My Chains Are Gone)', 'Chris Tomlin', 'hymn'],
  ['Blessed Assurance', 'CeCe Winans', 'hymn'],
  ['Break Every Chain', 'Tasha Cobbs Leonard', 'gospel'],
  ['Every Praise', 'Hezekiah Walker', 'gospel'],
  ['You Deserve It', 'JJ Hairston', 'gospel'],
  ['Glory to God in the Highest', 'Nathaniel Bassey', 'gospel'],
  ['Onise Iyanu', 'Nathaniel Bassey', 'worship'],
  ['Excess Love', 'Mercy Chinwo', 'gospel'],
  ['Nara', 'Tim Godfrey', 'gospel'],
  ['Imela', 'Nathaniel Bassey', 'worship'],
].map(([title, artist, category], index) => ({
  id: `christian-${index}`, title, artist, category,
  artwork: CHRISTIAN_SONG_ARTWORK[`christian-${index}`]?.artwork ?? '',
  storeUrl: CHRISTIAN_SONG_ARTWORK[`christian-${index}`]?.storeUrl ?? '',
}));

export type ChristianSong = (typeof CHRISTIAN_SONGS)[number];

export function shuffleChristianSongs(random = Math.random): ChristianSong[] {
  const songs = [...CHRISTIAN_SONGS];
  for (let i = songs.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [songs[i], songs[j]] = [songs[j], songs[i]];
  }
  return songs;
}

/* NFKD splits an accent off its letter; the marks are then dropped rather
   than turned into spaces, so "Ònísé" and "Onise" are one word. iTunes and
   LRCLIB disagree on accents for exactly the Nigerian gospel this list holds. */
const normalize = (text: string) => text.toLowerCase().normalize('NFKD')
  .replace(/\p{M}+/gu, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function filterChristianSongs(songs: ChristianSong[], query: string): ChristianSong[] {
  const words = normalize(query).split(' ').filter(Boolean);
  return songs.filter(song => words.every(word => normalize(`${song.title} ${song.artist} ${song.category}`).includes(word)));
}

/* A label naming a version or a guest, not a different song: "(Live)",
   "[Radio Edit]", "(feat. Someone)", "(with Someone)", " - Live at …",
   " ft. Someone". A subtitle such as "(Where Feet May Fail)" stays — it can
   be the only thing between two songs of one name. */
const VERSION_LABEL = /\s*[([](?:live|remaster|radio|acoustic|feat\b|ft\b|featuring\b|with\b)[^)\]]*[)\]]/gi;
const VERSION_TAIL = /\s+-\s+(?:live|remaster|radio|acoustic|feat\b|ft\b|featuring\b).*$/i;
const GUEST_TAIL = /\s+(?:feat\.|ft\.|featuring)\s.*$/i;

/** The title without version or guest labels, as typed (not normalised). */
export function baseSongTitle(title: string): string {
  return title.replace(VERSION_LABEL, '').replace(VERSION_TAIL, '').replace(GUEST_TAIL, '').trim() || title.trim();
}

/* Where one credited name ends and the next begins: "A & B", "A, B",
   "A + B", "A x B", "A and B", "A feat. B". */
const ARTIST_BREAK = /\s*[&,+]\s*|\s+(?:x|and|feat\.?|ft\.|featuring)\s+/i;

/** The first-named artist: "A & B", "A, B", "A x B", "A and B", "A feat. B" → "A". */
export function primaryArtist(artist: string): string {
  return artist.split(ARTIST_BREAK)[0].trim() || artist.trim();
}

/**
 * What to ask a lyrics catalogue for. LRCLIB's search wants every word it
 * is given — one word no record holds and the answer is empty — so
 * "(feat. Someone)" and a second artist only narrow it to the records that
 * happen to list them too.
 */
export function songSearchTerms(song: { title: string; artist: string }): string {
  return `${baseSongTitle(song.title)} ${primaryArtist(song.artist)}`.trim();
}

/**
 * Reject unrelated songs with the same title; allow labelled live versions,
 * guest credits and a duet listed under either name.
 *
 * The artist check is the guard that matters: two songs of one title are
 * common in worship, so it never loosens to "shares a word" — "Worship" is
 * not "Hillsong Worship". It accepts the hit naming the whole artist (the
 * original rule), the hit being one whole credited name of the artist
 * ("Elevation Worship" for "A & Elevation Worship"), or the two first-named
 * artists being the same ("A" for "A feat. B").
 */
export function matchesChristianSong(hit: { title: string; artist: string }, song: { title: string; artist: string }): boolean {
  if (normalize(baseSongTitle(hit.title)) !== normalize(baseSongTitle(song.title))) return false;
  const found = normalize(hit.artist);
  const wanted = normalize(song.artist);
  if (found.includes(wanted)) return true;
  if (found && song.artist.split(ARTIST_BREAK).some(name => normalize(name) === found)) return true;
  const lead = normalize(primaryArtist(hit.artist));
  return !!lead && lead === normalize(primaryArtist(song.artist));
}
