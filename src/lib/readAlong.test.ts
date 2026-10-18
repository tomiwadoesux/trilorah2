import { describe, expect, it } from 'vitest';
import { ReadAlong, readingWords, type FollowReading, type FollowVerse } from './readAlong';

const JOHN_3: Record<number, string> = {
  16: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
  17: 'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.',
  18: 'He that believeth on him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God.',
  19: 'And this is the condemnation, that light is come into the world, and men loved darkness rather than light, because their deeds were evil.',
};

const PSALM_136: Record<number, string> = {
  1: 'O give thanks unto the LORD; for he is good: for his mercy endureth for ever.',
  2: 'O give thanks unto the God of gods: for his mercy endureth for ever.',
  3: 'O give thanks to the Lord of lords: for his mercy endureth for ever.',
};

const verse = (texts: Record<number, string>, n: number): FollowVerse => ({ verse: n, text: texts[n] });

function reading(book: string, chapter: number, texts: Record<number, string>, first: number, last = first, pages?: [number, number][]): FollowReading {
  const verses = Array.from({ length: last - first + 1 }, (_, i) => verse(texts, first + i));
  return {
    book,
    chapter,
    verses,
    pages: (pages ?? [[first, last]]).map(([a, b]) => ({ first: a, last: b })),
    page: 0,
  };
}

/** A follower with John 3:`first` on the wall and the verse after it looked up. */
function onWall(first: number, last = first, pages?: [number, number][]) {
  const follower = new ReadAlong();
  follower.load(reading('John', 3, JOHN_3, first, last, pages));
  follower.setAfter(JOHN_3[last + 1] ? verse(JOHN_3, last + 1) : null, last + 1);
  return follower;
}

/** Speak `text` the way the recogniser sends it: growing partials, word by word, then the final. */
function speak(follower: ReadAlong, text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const steps = [];
  for (let n = 1; n <= words.length; n++) {
    const step = follower.hear(words.slice(0, n).join(' '), false);
    if (step) steps.push({ at: words[n - 1], step });
  }
  const last = follower.hear(text, true);
  if (last) steps.push({ at: 'final', step: last });
  return steps;
}

describe('readingWords', () => {
  it('keeps the words the translators supplied and drops their notes', () => {
    expect(readingWords('And darkness {was} upon the face {of: Heb. over} the deep.')).toEqual(['and', 'darkn', 'was', 'upon', 'the', 'face', 'the', 'deep']);
  });

  it('meets the reader halfway on old endings and capitals', () => {
    expect(readingWords('whosoever believeth')).toEqual(readingWords('Whosoever believes'));
    expect(readingWords('the LORD')).toEqual(readingWords('the Lord'));
  });
});

describe('ReadAlong — moving on as he reads', () => {
  it('follows the next existing verse when a translation omits a number', () => {
    const follower = onWall(16);
    follower.setAfter(verse(JOHN_3, 18), 17);
    expect(speak(follower, `${JOHN_3[16]} He that believeth on him`)).toEqual([{ at: 'life.', step: { kind: 'verse', verse: 18 } }]);
    const commanded = onWall(16);
    commanded.setAfter(verse(JOHN_3, 18), 17);
    expect(commanded.nav('next')).toEqual({ kind: 'verse', verse: 18 });
  });
  it('moves at the end of the verse when he reads straight through', () => {
    const follower = onWall(16);
    const steps = speak(follower, `${JOHN_3[16]} For God sent not his Son`);
    expect(steps).toEqual([{ at: 'life.', step: { kind: 'verse', verse: 17 } }]);
  });

  it('does not move while he quotes the ending in his own words', () => {
    const follower = onWall(16);
    expect(speak(follower, 'that is why he says we should have everlasting life for God loves you church')).toEqual([]);
    expect(speak(follower, 'they shall have everlasting life for god sent his love')).toEqual([]);
  });

  it('moves once when the whole verse has been read, without waiting for the next opening', () => {
    const follower = onWall(16);
    expect(speak(follower, JOHN_3[16])).toEqual([{ at: 'life.', step: { kind: 'verse', verse: 17 } }]);
    expect(speak(follower, 'now church notice the word whosoever it means you and me')).toEqual([]);
  });

  it('moves five words into the next verse when he goes back to the text after preaching', () => {
    const follower = onWall(16);
    speak(follower, 'now notice that word whosoever, it means anybody at all');
    const steps = speak(follower, 'For God sent not his Son into the world');
    expect(steps).toEqual([{ at: 'his', step: { kind: 'verse', verse: 17 } }]);
  });

  it('takes one misheard word five words in, but not three', () => {
    const follower = onWall(16);
    speak(follower, 'church listen to this');
    expect(speak(follower, 'for god said not his son into the world')).toEqual([{ at: 'his', step: { kind: 'verse', verse: 17 } }]);
    const strict = onWall(16);
    expect(speak(strict, 'have everlasting life for god said')).toEqual([]);
  });

  it('follows one verse after another, each on its own reading', () => {
    const follower = onWall(16);
    expect(speak(follower, `${JOHN_3[16]} For God sent not`)).toEqual([{ at: 'life.', step: { kind: 'verse', verse: 17 } }]);
    follower.load(reading('John', 3, JOHN_3, 17));
    follower.setAfter(verse(JOHN_3, 18), 18);
    const steps = speak(follower, `his Son into the world to condemn the world; but that the world through him might be saved. He that believeth on him`);
    expect(steps).toEqual([{ at: 'saved.', step: { kind: 'verse', verse: 18 } }]);
  });

  it('does not count words said before the verse went up', () => {
    const follower = new ReadAlong();
    follower.hear('should not perish but have everlasting life', false);
    follower.load(reading('John', 3, JOHN_3, 16));
    follower.setAfter(verse(JOHN_3, 17), 17);
    /* The same sentence growing: its first words were said before the press,
       so "for god sent" has no reading of verse 16 before it — five words of
       verse 17 are needed instead. */
    expect(follower.hear('should not perish but have everlasting life for god sent', false)).toBeNull();
    expect(follower.hear('should not perish but have everlasting life for god sent not his', false)).toEqual({ kind: 'verse', verse: 17 });
  });

  it('stops where the chapter ends', () => {
    const follower = new ReadAlong();
    follower.load(reading('John', 3, JOHN_3, 19));
    follower.setAfter(null, 20);
    expect(speak(follower, `${JOHN_3[19]} and that is the end of the chapter`)).toEqual([]);
    expect(follower.nav('next')).toBeNull();
  });

  it('ignores a late answer for another reading', () => {
    const follower = onWall(16);
    follower.setAfter(verse(JOHN_3, 19), 19);
    expect(speak(follower, `${JOHN_3[16]} For God sent not`)).toEqual([{ at: 'life.', step: { kind: 'verse', verse: 17 } }]);
  });
});

describe('ReadAlong — a psalm that repeats itself', () => {
  it('moves only across the line between verses, never on an opening the verse shares', () => {
    const follower = new ReadAlong();
    follower.load(reading('Psalms', 136, PSALM_136, 1));
    follower.setAfter(verse(PSALM_136, 2), 2);
    expect(speak(follower, 'O give thanks unto the LORD; for he is good')).toEqual([]);
    expect(speak(follower, 'for his mercy endureth for ever. O give thanks')).toEqual([{ at: 'ever.', step: { kind: 'verse', verse: 2 } }]);
    follower.load(reading('Psalms', 136, PSALM_136, 2));
    follower.setAfter(verse(PSALM_136, 3), 3);
    expect(speak(follower, 'unto the God of gods: for his mercy endureth for ever.')).toEqual([{ at: 'ever.', step: { kind: 'verse', verse: 3 } }]);
    expect(speak(follower, 'O give thanks to the Lord')).toEqual([]);
  });
});

describe('ReadAlong — a reading in pages', () => {
  it('does not absorb next verse when reading within a page has not moved the wall', () => {
    const follower = onWall(16, 18, [[16, 17], [18, 18]]);
    speak(follower, `${JOHN_3[16]} For God sent not his Son`);
    expect(follower.nav('next')).toEqual({ kind: 'page', page: 1 });
  });
  it('turns the page when he reads into a verse on the next one, then puts up the verse after', () => {
    const follower = onWall(16, 18, [[16, 17], [18, 18]]);
    expect(speak(follower, `${JOHN_3[16]} ${JOHN_3[17]}`)).toEqual([{ at: 'saved.', step: { kind: 'page', page: 1 } }]);
    expect(speak(follower, 'He that believeth on him')).toEqual([]);
    expect(speak(follower, `is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God. And this is the`)).toEqual([
      { at: 'God.', step: { kind: 'verse', verse: 19 } },
    ]);
  });

  it('starts from the page the operator turns to', () => {
    const follower = onWall(16, 18, [[16, 17], [18, 18]]);
    follower.setPage(1);
    expect(speak(follower, `${JOHN_3[18]} And this is the condemnation`)).toEqual([{ at: 'God.', step: { kind: 'verse', verse: 19 } }]);
  });
});

describe('ReadAlong — "next verse" and auto advance are one step', () => {
  it('uses speech buffered while the next verse was loading exactly once', () => {
    const follower = new ReadAlong();
    follower.load(reading('John', 3, JOHN_3, 16));
    expect(speak(follower, `${JOHN_3[16]} For God sent not his Son`)).toEqual([]);
    follower.setAfter(verse(JOHN_3, 17), 17);
    expect(follower.resume()).toEqual({ kind: 'verse', verse: 17 });
    expect(follower.resume()).toBeNull();
    expect(follower.nav('next')).toEqual({ kind: 'absorbed' });
  });

  it('does not carry an absorbed command across an operator selection', () => {
    const follower = onWall(16);
    speak(follower, `${JOHN_3[16]} For God sent not`);
    follower.load(null);
    follower.load(reading('John', 3, JOHN_3, 18));
    follower.setAfter(verse(JOHN_3, 19), 19);
    expect(follower.nav('next')).toEqual({ kind: 'verse', verse: 19 });
  });
  it('absorbs "next verse" said just after the wall moved by itself, and moves when it is said again', () => {
    const follower = onWall(16);
    speak(follower, `${JOHN_3[16]} For God sent not`);
    follower.load(reading('John', 3, JOHN_3, 17));
    follower.setAfter(verse(JOHN_3, 18), 18);
    expect(follower.nav('next')).toEqual({ kind: 'absorbed' });
    expect(follower.nav('next')).toEqual({ kind: 'verse', verse: 18 });
  });

  it('absorbs it while the wall is still on its way to the next verse', () => {
    const follower = onWall(16);
    speak(follower, `${JOHN_3[16]} For God sent not`);
    expect(follower.nav('next')).toEqual({ kind: 'absorbed' });
  });

  it('moves on "next verse" said first, and does not move again when he reads the verse it put up', () => {
    const follower = onWall(16);
    speak(follower, 'For God so loved the world');
    expect(follower.nav('next')).toEqual({ kind: 'verse', verse: 17 });
    follower.load(reading('John', 3, JOHN_3, 17));
    follower.setAfter(verse(JOHN_3, 18), 18);
    expect(speak(follower, 'For God sent not his Son into the world to condemn the world')).toEqual([]);
  });

  it('absorbs the first late next verse even after more reading', () => {
    const follower = onWall(16);
    speak(follower, `${JOHN_3[16]} For God sent not`);
    follower.load(reading('John', 3, JOHN_3, 17));
    follower.setAfter(verse(JOHN_3, 18), 18);
    speak(follower, 'his Son into the world to condemn the world');
    expect(follower.nav('next')).toEqual({ kind: 'absorbed' });
    expect(follower.nav('next')).toEqual({ kind: 'verse', verse: 18 });
  });

  it('pages a reading with "next verse", then goes on past it', () => {
    const follower = onWall(16, 18, [[16, 17], [18, 18]]);
    expect(follower.nav('next')).toEqual({ kind: 'page', page: 1 });
    expect(follower.nav('next')).toEqual({ kind: 'verse', verse: 19 });
  });

  it('goes back a verse, and back past the start of a reading', () => {
    const follower = onWall(17);
    expect(follower.nav('previous')).toEqual({ kind: 'verse', verse: 16 });
    const paged = onWall(16, 18, [[16, 17], [18, 18]]);
    paged.setPage(1);
    expect(paged.nav('previous')).toEqual({ kind: 'page', page: 0 });
  });

  it('does nothing with nothing on the wall', () => {
    const follower = new ReadAlong();
    expect(follower.nav('next')).toBeNull();
    expect(follower.hear('for god sent not his son', false)).toBeNull();
  });
});


describe('completion safeguards', () => {
  it('cannot advance again from the same cumulative partial or final', () => {
    const f = onWall(16);
    expect(f.hear(JOHN_3[16], false)).toEqual({ kind: 'verse', verse: 17 });
    f.load(reading('John', 3, JOHN_3, 17)); f.setAfter(verse(JOHN_3, 18), 18);
    expect(f.hear(JOHN_3[16], true)).toBeNull();
    expect(f.hear(JOHN_3[17], true)).toEqual({ kind: 'verse', verse: 18 });
  });
  it('does not count speech from while following was paused', () => {
    const f = onWall(16); f.skip(JOHN_3[16], false);
    expect(f.hear(JOHN_3[16], true)).toBeNull();
  });
  it('does not advance from a repeated ending alone', () => {
    const f = onWall(16);
    expect(speak(f, 'should not perish but have everlasting life')).toEqual([]);
    expect(speak(f, 'should not perish but have everlasting life')).toEqual([]);
  });
});
