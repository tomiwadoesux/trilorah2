/** Ordered, local lyric matching. Common words alone never qualify. */
const words = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
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
/**
 * How well the last words heard match a run of these lyrics, 0 when they
 * do not. The newest words are what count: a line of a song sung after
 * half a sentence of talk is scored on the line, not on the sentence, so
 * every ending of what was heard is tried and the best one wins. Four words
 * of a line are enough to start matching.
 */
export function lyricScore(heard: string, lyrics: string): number {
  const all = words(heard).slice(-20);
  const target = lyricWords(lyrics);
  if (all.length < 4) return 0;
  const distinctive = [...new Set(all.filter((word) => !common.has(word)))];
  if (distinctive.filter((word) => target.some((candidate) => similar(word, candidate))).length < 3) return 0;
  let best = 0;
  for (let from = 0; from <= all.length - 4; from++) {
    const query = all.slice(from);
    for (let start = 0; start < target.length; start++) {
      const window = target.slice(start, start + query.length + 3);
      let at = 0, hits = 0;
      const meaningful = new Set<string>();
      for (const word of query) {
        const found = window.findIndex((w, i) => i >= at && similar(word, w));
        if (found >= 0) { at = found + 1; hits++; if (!common.has(word)) meaningful.add(word); }
      }
      if (meaningful.size >= 3 && hits >= 4) best = Math.max(best, hits / query.length);
    }
  }
  return best >= 0.6 ? best : 0;
}
