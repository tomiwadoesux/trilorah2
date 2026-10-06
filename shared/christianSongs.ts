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

const normalize = (text: string) => text.toLowerCase().normalize('NFKD')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function filterChristianSongs(songs: ChristianSong[], query: string): ChristianSong[] {
  const words = normalize(query).split(' ').filter(Boolean);
  return songs.filter(song => words.every(word => normalize(`${song.title} ${song.artist} ${song.category}`).includes(word)));
}

/** Reject unrelated songs with the same title; allow labelled live versions. */
export function matchesChristianSong(hit: { title: string; artist: string }, song: ChristianSong): boolean {
  const title = (value: string) => normalize(value.replace(/\s*[([](?:live|remaster|radio|acoustic)[^)\]]*[)\]]/gi, '').replace(/\s+-\s+(live|remaster|radio|acoustic).*$/i, ''));
  return title(hit.title) === title(song.title)
    && normalize(hit.artist).split(' ').join(' ').includes(normalize(song.artist));
}
