import { describe, expect, it } from 'vitest'
import {
  cardsToSections,
  deleteCard,
  dropDraft,
  duplicateCard,
  editCount,
  isDirty,
  lineAtOffset,
  mergeWithNext,
  moveCard,
  nextPartLabel,
  parseDrafts,
  putDraft,
  sectionsToCards,
  splitCard,
  type EditorCard,
  type SongBase,
  type SongDraft,
} from './songDraft'

/* Invented lines — no real song is quoted anywhere in this file. */
const card = (label: string, text: string, key = label): EditorCard => ({ key, label, text })
const FOUR = 'lamp one on the hill\nlamp two by the sea\nlamp three in the field\nlamp four over me'

const base: SongBase = {
  title: 'Four Lamps',
  author: 'Nobody',
  sections: [
    { label: 'Verse 1', lines: FOUR.split('\n') },
    { label: 'Chorus', lines: ['carry the lamps', 'carry them home'] },
  ],
}

describe('cards ↔ sections', () => {
  it('round-trips a song', () => {
    expect(cardsToSections(sectionsToCards(base.sections))).toEqual(base.sections)
  })

  it('drops empty cards and blank lines, and names an unlabelled slide', () => {
    const out = cardsToSections([card('', ' a \n\n b '), card('Verse 2', '  \n ')])
    expect(out).toEqual([{ label: 'Slide 1', lines: ['a', 'b'] }])
  })

  it('gives every card a distinct key', () => {
    const keys = sectionsToCards(base.sections).map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('splitCard', () => {
  it('finds the caret line', () => {
    expect(lineAtOffset(FOUR, 0)).toBe(0)
    expect(lineAtOffset(FOUR, FOUR.indexOf('lamp three') + 3)).toBe(2)
  })

  it('cuts above the caret line and loses nothing', () => {
    const out = splitCard([card('Verse 1', FOUR)], 0, FOUR.indexOf('lamp three'))
    expect(out.map((c) => c.label)).toEqual(['Verse 1', 'Verse 1 (2)'])
    expect(out[0].text).toBe('lamp one on the hill\nlamp two by the sea')
    expect(out[1].text).toBe('lamp three in the field\nlamp four over me')
    expect(out[0].key).toBe('Verse 1')
    expect(out[1].key).not.toBe('Verse 1')
  })

  it('moves a first-line cut down one line rather than making an empty slide', () => {
    const out = splitCard([card('Verse 1', FOUR)], 0, 0)
    expect(out[0].text).toBe('lamp one on the hill')
    expect(out).toHaveLength(2)
  })

  it('refuses a cut that would leave a half empty — same list back', () => {
    const one = [card('Tag', 'only line')]
    expect(splitCard(one, 0, 3)).toBe(one)
    const blankTail = [card('Tag', 'only line\n\n')]
    expect(splitCard(blankTail, 0, 11)).toBe(blankTail)
  })

  it('numbers a third part past the ones already there', () => {
    expect(nextPartLabel('Verse 1', ['Verse 1', 'Verse 1 (2)'])).toBe('Verse 1 (3)')
    expect(nextPartLabel('Verse 1 (2)', ['Verse 1', 'Verse 1 (2)'])).toBe('Verse 1 (3)')
  })
})

describe('merge, duplicate, delete, move', () => {
  const three = [card('A', 'a1\na2'), card('B', 'b1'), card('C', 'c1')]

  it('merges with the next card under the first label', () => {
    const out = mergeWithNext(three, 0)
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ label: 'A', text: 'a1\na2\nb1', key: 'A' })
  })

  it('split then merge gives the words back', () => {
    const cut = splitCard([card('Verse 1', FOUR)], 0, FOUR.indexOf('lamp three'))
    expect(mergeWithNext(cut, 0)[0].text).toBe(FOUR)
  })

  it('has nothing to merge the last card with', () => {
    expect(mergeWithNext(three, 2)).toBe(three)
  })

  it('duplicates in place with a new key', () => {
    const out = duplicateCard(three, 1)
    expect(out.map((c) => c.label)).toEqual(['A', 'B', 'B', 'C'])
    expect(out[2].key).not.toBe(out[1].key)
  })

  it('never deletes the last card', () => {
    expect(deleteCard(three, 1).map((c) => c.label)).toEqual(['A', 'C'])
    const one = [card('A', 'a')]
    expect(deleteCard(one, 0)).toBe(one)
  })

  it('moves, and ignores moves that go nowhere', () => {
    expect(moveCard(three, 0, 2).map((c) => c.label)).toEqual(['B', 'C', 'A'])
    expect(moveCard(three, 2, 0).map((c) => c.label)).toEqual(['C', 'A', 'B'])
    expect(moveCard(three, 1, 1)).toBe(three)
    expect(moveCard(three, 0, 3)).toBe(three)
    expect(moveCard(three, -1, 0)).toBe(three)
  })
})

describe('isDirty', () => {
  const now = () => ({ title: base.title, author: base.author, cards: sectionsToCards(base.sections) })

  it('is clean on open', () => {
    expect(isDirty(base, now())).toBe(false)
  })

  it('ignores whitespace that would not be stored', () => {
    const n = now()
    n.title = `${base.title}  `
    n.cards[0] = { ...n.cards[0], text: `${n.cards[0].text}\n\n` }
    n.cards.push(card('Verse 9', '   '))
    expect(isDirty(base, n)).toBe(false)
  })

  it('sees a word, a label, a title and an order change', () => {
    const word = now()
    word.cards[1] = { ...word.cards[1], text: 'carry the lamps\ncarry them on' }
    expect(isDirty(base, word)).toBe(true)

    const label = now()
    label.cards[1] = { ...label.cards[1], label: 'Refrain' }
    expect(isDirty(base, label)).toBe(true)

    expect(isDirty(base, { ...now(), title: 'Five Lamps' })).toBe(true)

    const order = now()
    order.cards = moveCard(order.cards, 0, 1)
    expect(isDirty(base, order)).toBe(true)
  })

  it('goes clean again when the edit is undone', () => {
    const n = now()
    const cut = splitCard(n.cards, 0, FOUR.indexOf('lamp three'))
    expect(isDirty(base, { ...n, cards: cut })).toBe(true)
    expect(isDirty(base, { ...n, cards: mergeWithNext(cut, 0) })).toBe(false)
  })

  it('counts the cards that differ', () => {
    const n = now()
    expect(editCount(base, n.cards)).toBe(0)
    n.cards[0] = { ...n.cards[0], text: 'different' }
    expect(editCount(base, n.cards)).toBe(1)
    expect(editCount(base, [...n.cards, card('Tag', 'more')])).toBe(2)
  })
})

describe('drafts', () => {
  const draft: SongDraft = {
    title: 'Four Lamps',
    author: 'Nobody',
    cards: [card('Verse 1', FOUR, 'k1'), card('Chorus', 'carry the lamps', 'k2')],
    scrollTop: 240,
    focusKey: 'k2',
    caret: 7,
    updatedAt: 1,
  }

  it('puts and drops without mutating', () => {
    const empty = {}
    const one = putDraft(empty, 'song-1', draft)
    expect(empty).toEqual({})
    expect(Object.keys(one)).toEqual(['song-1'])
    expect(dropDraft(one, 'song-1')).toEqual({})
    expect(dropDraft(one, 'nope')).toBe(one)
  })

  it('survives a trip through JSON exactly — scroll, focus and caret included', () => {
    const back = parseDrafts(JSON.stringify(putDraft({}, 'song-1', draft)))
    expect(back['song-1']).toEqual(draft)
  })

  it('accepts the object form the settings bridge hands back', () => {
    expect(parseDrafts({ 'song-1': draft })['song-1']).toEqual(draft)
  })

  it('drops a broken entry and keeps the good one', () => {
    const back = parseDrafts({
      good: draft,
      noCards: { ...draft, cards: [] },
      badCard: { ...draft, cards: [{ label: 'x' }] },
      notAnObject: 4,
      noTitle: { cards: draft.cards },
    })
    expect(Object.keys(back)).toEqual(['good'])
  })

  it('never throws on rubbish', () => {
    expect(parseDrafts('{not json')).toEqual({})
    expect(parseDrafts(null)).toEqual({})
    expect(parseDrafts([draft])).toEqual({})
    expect(parseDrafts(undefined)).toEqual({})
  })

  it('forgets a focus key that points at no card, and clamps a bad scroll', () => {
    const back = parseDrafts({ s: { ...draft, focusKey: 'gone', scrollTop: -5, caret: Number.NaN } })
    expect(back.s.focusKey).toBeNull()
    expect(back.s.scrollTop).toBe(0)
    expect(back.s.caret).toBe(0)
  })

  it('keeps an unsaved song only when it still has its base', () => {
    const back = parseDrafts({
      'new:1': { ...draft, base },
      'new:2': draft,
      'new:3': { ...draft, base: { title: 'x', sections: [{ label: 'a', lines: [3] }] } },
    })
    expect(Object.keys(back)).toEqual(['new:1'])
    expect(back['new:1'].base).toEqual(base)
  })
})
