/** Ordered, local lyric matching. Common words alone never qualify. */
const homophones: Record<string, string> = { reign: 'rain', reigns: 'rains', grate: 'great', sun: 'son', their: 'there', theyre: 'there', youre: 'your' };
const words = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean).map(word => homophones[word] ?? word);
const tokenCache = new Map<string, string[]>();
function lyricWords(text: string) {
  const cached = tokenCache.get(text);
  if (cached) return cached;
  const tokens = words(text);
  if (tokenCache.size >= 2048) tokenCache.delete(tokenCache.keys().next().value!);
  tokenCache.set(text, tokens);
  return tokens;
}
const common = new Set('the a an and or to of in on is it you i we he she my your our me oh'.split(' '));
const similar = (a: string, b: string) => {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, errors = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++errors > 1) return false;
    if (a.length <= b.length) j++;
    if (a.length >= b.length) i++;
  }
  return errors + (a.length - i) + (b.length - j) <= 1;
};
/** How much of a line must be heard before it counts as that song. */
export interface MatchBar {
  /** Words of the line heard, in its order. */
  words: number;
  /** Of those, how many must be other than the commonest words. */
  distinct: number;
  /** The share of the phrase heard that must be in the line. */
  share: number;
}

/** "search song" was pressed: the operator is asking, so four words of a line will do. */
export const ASKED_BAR: MatchBar = { words: 4, distinct: 3, share: 0.6 };

/**
 * Nobody asked — the song is offered by itself (owner, 2026-10-17: "maybe
 * 6-7 words"). Seven words of one line, four of them uncommon, and nearly
 * everything in the phrase heard: "you are worthy" is in half the sermons
 * preached, a whole line only one song has is a safe bet.
 */
export const HEARD_BAR: MatchBar = { words: 7, distinct: 4, share: 0.8 };

/**
 * How well the last words heard match a run of these lyrics, 0 when they
 * do not. The newest words are what count: a line of a song sung after
 * half a sentence of talk is scored on the line, not on the sentence, so
 * every phrase in the recent words is tried and the best one wins. This
 * includes the words immediately before the operator asks to find a song.
 * With the operator asking, four words of a line are enough to start
 * matching; see the bars above.
 */
export function lyricScore(heard: string, lyrics: string, bar: MatchBar = ASKED_BAR): number {
  const all = words(heard).slice(-14);
  const target = lyricWords(lyrics);
  if (all.length < bar.words) return 0;
  const distinctive = [...new Set(all.filter((word) => !common.has(word)))];
  if (distinctive.filter((word) => target.some((candidate) => similar(word, candidate))).length < bar.distinct) return 0;
  let best = 0;
  for (let end = all.length; end >= bar.words; end--) {
    for (let from = 0; from <= end - bar.words; from++) {
      const query = all.slice(from, end);
      for (let start = 0; start < target.length; start++) {
        const window = target.slice(start, start + query.length + 3);
        let at = 0, hits = 0;
        const meaningful = new Set<string>();
        for (const word of query) {
          const found = window.findIndex((wordInSong, index) => index >= at && similar(word, wordInSong));
          if (found >= 0) {
            at = found + 1;
            hits++;
            if (!common.has(word)) meaningful.add(word);
          }
        }
        if (meaningful.size >= bar.distinct && hits >= bar.words) {
          best = Math.max(best, hits / query.length);
          if (best === 1) return best;
        }
      }
    }
  }
  return best >= bar.share ? best : 0;
}

/**
 * Whether the words heard are scripture being read rather than a song sung:
 * as much of one of these verses as a song offered by itself needs of its
 * line. A hymn that borrows a verse's words — "To God Be the Glory" has
 * John 3:16 in it — is then offered only when the operator presses "search
 * song" (owner, 2026-10-17: "it should not bring song if it is a verse
 * except if I click the find song").
 */
export function readsAsVerse(heard: string, verses: readonly string[]): boolean {
  return verses.some((verse) => lyricScore(heard, verse, HEARD_BAR) > 0);
}

/** The uncommon words heard that are also in these lyrics — what to look the Bible up by. */
export function sharedWords(heard: string, lyrics: string): string[] {
  const line = lyricWords(lyrics);
  return [...new Set(words(heard).filter((word) => !common.has(word) && line.some((candidate) => similar(word, candidate))))];
}

/** Include finalized speech and the in-progress line, even before search starts. */
export function recentSongWords(spoken: { lines: readonly { text: string }[]; partial: string }): string {
  return [...spoken.lines.map(line => line.text), spoken.partial].join(' ').trim().split(/\s+/).filter(Boolean).slice(-14).join(' ');
}

export interface MatchableSong {
  id: string;
  title: string;
  sections: { label: string; lines: string[] }[];
}

export interface SongMatch {
  song: MatchableSong;
  section: number;
  lines: string[];
  label: string;
  score: number;
}

export function matchSongs(heard: string, songs: readonly MatchableSong[], bar: MatchBar = ASKED_BAR): SongMatch[] {
  return songs.flatMap(song => song.sections.map((section, index) => ({ song, section: index, lines: section.lines, label: section.label, score: lyricScore(heard, section.lines.join(' '), bar) })))
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter((match, index, all) => all.findIndex(other => other.song.id === match.song.id) === index)
    .slice(0, 4);
}

/** A transcript correction or a pause must not remove a card under the pointer. */
export function retainSongMatches(previous: readonly SongMatch[], incoming: readonly SongMatch[]): SongMatch[] {
  if (!incoming.length) return [...previous];
  const updated = new Map(incoming.map(match => [match.song.id, match]));
  const retained = previous.map(match => updated.get(match.song.id) ?? match);
  const additions = incoming.filter(match => !previous.some(old => old.song.id === match.song.id));
  return [...additions, ...retained].slice(0, 4);
}
