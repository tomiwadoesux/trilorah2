import { verseToText } from './scriptureText';

/*
 * Auto advance: the wall follows the preacher through the reading it shows
 * (owner, 2026-10-17: "as the preacher reads the verse, it goes to the next
 * without him saying next verse").
 *
 * It moves after a near-complete reading ending in the verse's last words.
 * A short quotation of the ending alone is insufficient. It also recognises
 * the boundary into the next verse and a fresh reading of its opening, so
 * following can resume after commentary or a transcription omission.
 *
 * A spoken "next verse" and a step the follower took by itself are ONE step,
 * whichever comes first: the preacher may not know auto advance is on
 * (owner). Said just after the wall moved by itself, it is absorbed; said
 * again, it moves. Said first, it moves the wall, and the reading that
 * follows is of the verse already up.
 *
 * Pure: the screen feeds it what the wall shows and what is heard, and does
 * what it answers (design/screens/AutoAdvance).
 */

/** Words of the next verse that, straight after this one's end, mean he read on. */
const RUN_IN = 3;
/** Of this verse's last six words, how many must lead into them, in order. */
const TAIL = 4;
/** Words of the next verse's opening that mean, on their own, he went back to the text. */
const JUMP_IN = 5;
/** Words kept while listening. A step is a few seconds of speech; older words take no part. */
const HEARD_CAP = 240;

/**
 * A verse or a transcript as words that can be compared: the KJV's marginal
 * notes gone, no punctuation, and every word cut to five letters, so that a
 * reader's "believes" meets the King James "believeth" and "Lord" meets
 * "LORD".
 */
export function readingWords(text: string): string[] {
  return verseToText(text)
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => (word.length > 5 ? word.slice(0, 5) : word));
}

/** heard[at…] is the opening of `verse`: its first `count` words, `misses` of them misheard at most, never the first. */
function opens(heard: readonly string[], at: number, verse: readonly string[], count: number, misses: number): boolean {
  if (at < 0 || at + count > heard.length || heard[at] !== verse[0]) return false;
  let missed = 0;
  for (let i = 1; i < count; i++) if (heard[at + i] !== verse[i] && ++missed > misses) return false;
  return true;
}

/** How many words of `b` appear in `a` in the same order (longest common subsequence). */
function inOrder(a: readonly string[], b: readonly string[]): number {
  const row = new Array<number>(b.length + 1).fill(0);
  for (const word of a) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = word === b[j - 1] ? diagonal + 1 : Math.max(row[j], row[j - 1]);
      diagonal = above;
    }
  }
  return row[b.length];
}

/** `run` appears somewhere in `verse`, `misses` words of it different at most. */
function within(verse: readonly string[], run: readonly string[], misses: number): boolean {
  for (let at = 0; at + run.length <= verse.length; at++) {
    let missed = 0;
    for (let i = 0; i < run.length && missed <= misses; i++) if (verse[at + i] !== run[i]) missed++;
    if (missed <= misses) return true;
  }
  return false;
}

/**
 * Where in `heard` (from `from` on) the preacher began reading `next` after
 * `current`, or -1 while he has not.
 */
export function readOn(heard: readonly string[], from: number, current: readonly string[], next: readonly string[]): number {
  if (!next.length) return -1;
  const start = Math.max(0, from);
  const runIn = Math.min(RUN_IN, next.length);
  const tail = Math.min(TAIL, current.length);
  const last = current[current.length - 1];
  if (tail > 0) {
    for (let at = start + 1; at + runIn <= heard.length; at++) {
      if (!opens(heard, at, next, runIn, 0)) continue;
      const before = heard.slice(Math.max(start, at - 8), at);
      /* He finished this verse — its last word is among the last two heard —
         and he was reading it, not quoting it: most of its ending, in order. */
      if (before.slice(-2).includes(last) && inOrder(before, current.slice(-6)) >= tail) return at;
    }
  }
  const jump = Math.min(JUMP_IN, next.length);
  const opening = next.slice(0, jump);
  /* An opening this verse shares (Psalm 136, "O give thanks unto the…")
     cannot be told from reading this one again; only reading through the
     line between them can. One that is nearly this verse's own words must
     at least be heard exactly. */
  if (within(current, opening, 0)) return -1;
  const misses = jump >= JUMP_IN && !within(current, opening, 1) ? 1 : 0;
  for (let at = start; at + jump <= heard.length; at++) {
    if (opens(heard, at, next, jump, misses)) return at;
  }
  return -1;
}

export interface FollowVerse {
  verse: number;
  text: string;
}

/** What the wall shows, as the follower needs it. */
export interface FollowReading {
  book: string;
  chapter: number;
  verses: readonly FollowVerse[];
  /** The first and last verse of each page; one page when the reading fits on one. */
  pages: readonly { first: number; last: number }[];
  /** The page on the wall now. */
  page: number;
}

export type FollowStep =
  /** Turn the reading on the wall to this page. */
  | { kind: 'page'; page: number }
  /** Put this verse of the same chapter on the wall. */
  | { kind: 'verse'; verse: number }
  /** A spoken "next verse" for the step the wall has just taken by itself. */
  | { kind: 'absorbed' };

export class ReadAlong {
  private book = '';
  private chapter = 0;
  /** The verses of the reading, and each as words. */
  private numbers: number[] = [];
  private words: string[][] = [];
  private pages: { first: number; last: number }[] = [];
  private page = 0;
  /** The verse after the reading: undefined until it is looked up, null where the chapter ends. */
  private after: { verse: number; words: string[] } | null | undefined = undefined;
  /** The verse this follower put up, until the wall says it shows it. */
  private pending: number | null = null;
  /** Which verse of the reading he is reading (an index into `numbers`). */
  private at = 0;
  /** What has been heard since the reading went up: finished sentences, then the one under way. */
  private said: string[] = [];
  private saying: string[] = [];
  /** How many words the sentence under way had when the wall changed — said before it, so not part of it. */
  private stale = 0;
  private sayingCount = 0;
  /** Where in what was heard the verse being read began. */
  private cursor = 0;
  /** The wall moved automatically; absorb the first next command until it is used or the operator changes the reading. */
  private credit = false;

  /** What the wall shows now, or null when it is not a reading. */
  load(reading: FollowReading | null): void {
    if (!reading?.verses.length) {
      this.book = '';
      this.numbers = [];
      this.words = [];
      this.pages = [];
      this.pending = null;
      this.after = undefined;
      this.restart();
      return;
    }
    const first = reading.verses[0].verse;
    const last = reading.verses[reading.verses.length - 1].verse;
    const chapter = reading.book === this.book && reading.chapter === this.chapter;
    if (chapter && this.pending !== null && this.pending === first && first === last) {
      /* The verse this follower put up has reached the wall: what is being
         heard runs on into it. Its words now come from the wall. */
      this.take(reading);
      this.pending = null;
      return;
    }
    if (chapter && this.pending === null && this.numbers[0] === first && this.numbers[this.numbers.length - 1] === last) {
      /* The same reading again — sliced together or apart, or its echo. */
      const at = this.at;
      this.take(reading);
      this.at = Math.min(at, this.numbers.length - 1);
      return;
    }
    this.take(reading);
    this.pending = null;
    this.after = undefined;
    this.at = Math.max(0, this.numbers.indexOf(this.pages[this.page]?.first ?? first));
    this.restart();
  }

  /** The verse after the reading, looked up for `verse` (null: the chapter ends before it). */
  setAfter(found: FollowVerse | null, verse: number): void {
    if (!this.numbers.length || verse !== this.numbers[this.numbers.length - 1] + 1) return;
    // Some translations omit numbered verses. Follow the next existing row.
    this.after = found && found.verse >= verse ? { verse: found.verse, words: readingWords(found.text) } : null;
  }

  /** The operator turned the page: he is reading from its first verse. */
  setPage(page: number): void {
    if (!this.numbers.length || page === this.page || !this.pages[page]) return;
    this.page = page;
    this.at = Math.max(0, this.numbers.indexOf(this.pages[page].first));
    this.cursor = this.heard().length;
    this.credit = false;
  }

  /** Words heard: a partial replaces the one before it, a final finishes it. */
  hear(text: string, isFinal: boolean): FollowStep | null {
    const all = readingWords(text);
    const fresh = all.slice(this.stale);
    if (isFinal) {
      if (this.numbers.length) this.said.push(...fresh);
      this.saying = [];
      this.stale = 0;
      this.sayingCount = 0;
    } else {
      this.saying = this.numbers.length ? fresh : [];
      this.sayingCount = all.length;
    }
    if (!this.numbers.length) return null;
    this.trim();
    return this.follow();
  }

  /** Observe paused speech without letting it move the internal reading cursor. */
  skip(text: string, isFinal: boolean): void {
    this.said = []; this.saying = []; this.cursor = 0;
    this.sayingCount = isFinal ? 0 : readingWords(text).length;
    this.stale = this.sayingCount;
  }

  /** Recheck buffered speech after the next verse finishes loading. */
  resume(): FollowStep | null { return this.follow(); }

  /** A spoken "next verse" or "previous verse", passed on by the engine while it follows. */
  nav(direction: 'next' | 'previous'): FollowStep | null {
    if (!this.numbers.length) return null;
    const heard = this.heard().length;
    if (direction === 'next' && this.credit) {
      this.credit = false;
      return { kind: 'absorbed' };
    }
    this.credit = false;
    /* What he reads from here on is of the verse he asked for. */
    this.cursor = heard;
    const destination = this.page + (direction === 'next' ? 1 : -1);
    if (this.pages[destination]) {
      this.page = destination;
      this.at = Math.max(0, this.numbers.indexOf(this.pages[destination].first));
      return { kind: 'page', page: destination };
    }
    if (direction === 'next') {
      if (this.after === null) return null;
      return this.putUp(this.after?.verse ?? this.numbers[this.numbers.length - 1] + 1, this.after?.words ?? []);
    }
    return this.numbers[0] > 1 ? this.putUp(this.numbers[0] - 1, []) : null;
  }

  private take(reading: FollowReading): void {
    this.book = reading.book;
    this.chapter = reading.chapter;
    this.numbers = reading.verses.map((v) => v.verse);
    this.words = reading.verses.map((v) => readingWords(v.text));
    this.pages = reading.pages.length
      ? reading.pages.map((p) => ({ first: p.first, last: p.last }))
      : [{ first: this.numbers[0], last: this.numbers[this.numbers.length - 1] }];
    this.page = Math.min(Math.max(0, reading.page), this.pages.length - 1);
  }

  private restart(): void {
    this.said = [];
    this.saying = [];
    this.stale = this.sayingCount;
    this.cursor = 0;
    this.credit = false;
  }

  private heard(): string[] {
    return this.saying.length ? [...this.said, ...this.saying] : this.said;
  }

  private trim(): void {
    const over = this.said.length - HEARD_CAP;
    if (over <= 0) return;
    this.said = this.said.slice(over);
    this.cursor = Math.max(0, this.cursor - over);
  }

  private follow(): FollowStep | null {
    const heard = this.heard();
    const was = this.at;
    for (;;) {
      const next = this.at + 1 < this.words.length ? this.words[this.at + 1] : this.after?.words;
      if (!next?.length || !this.words[this.at]) break;
      const current = this.words[this.at];
      const fresh = heard.slice(this.cursor);
      const tail = current.slice(-Math.min(4, current.length));
      const completed = fresh.length >= current.length * .8 &&
        inOrder(fresh, current) >= Math.ceil(current.length * .85) &&
        tail.every((word, i) => fresh[fresh.length - tail.length + i] === word);
      const start = completed ? heard.length : readOn(heard, this.cursor, current, next);
      if (start < 0) break;
      this.cursor = start;
      if (this.at + 1 < this.words.length) {
        this.at += 1;
        continue;
      }
      this.credit = true;
      return this.putUp(this.after!.verse, next);
    }
    if (this.at === was) {
      return null;
    }
    const step = this.turnTo(this.at);
    if (step) this.credit = true;
    return step;
  }

  /** The verse goes up in place of the reading; listening runs on into it. */
  private putUp(verse: number, words: string[]): FollowStep {
    this.numbers = [verse];
    this.words = [words];
    this.pages = [{ first: verse, last: verse }];
    this.page = 0;
    this.at = 0;
    this.after = undefined;
    this.pending = verse;
    return { kind: 'verse', verse };
  }

  private turnTo(at: number): FollowStep | null {
    const verse = this.numbers[at];
    const page = this.pages.findIndex((p) => verse >= p.first && verse <= p.last);
    if (page < 0 || page === this.page) return null;
    this.page = page;
    return { kind: 'page', page };
  }
}
