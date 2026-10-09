import { describe, expect, it } from 'vitest';
import { deckPage } from '../design/screens/deckPage';

describe('presentation thumbnails', () => {
  it('keeps different decks with the same theme distinct and reflects saved edits', () => {
    const original = { title: 'Sunday welcome', sections: [] };
    const first = deckPage(0, 0, original);
    const other = deckPage(0, 0, { title: 'Youth evening', sections: [] });
    expect(other).not.toBe(first);
    expect(decodeURIComponent(other)).toContain('Youth evening');
    original.title = 'Updated welcome';
    const edited = deckPage(0, 0, original);
    expect(edited).not.toBe(first);
    expect(decodeURIComponent(edited)).toContain('Updated welcome');
    expect(deckPage(0, 0, original)).toBe(edited);
  });
});
