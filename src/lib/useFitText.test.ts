import { expect, it } from 'vitest';
import { LYRIC_TYPE, lyricLetterSpacing } from '../../shared/textSpacing';
import { FIT_FLOOR } from './useFitText';

it('stops shrinking a lyric at the smallest size a reading may be', () => {
  expect(LYRIC_TYPE.floor * LYRIC_TYPE.scale).toBeCloseTo(FIT_FLOOR);
});

it('closes up mixed-case lyrics and gives capitals a little air', () => {
  expect(lyricLetterSpacing('none', 'normal')).toBe('-0.015em');
  expect(lyricLetterSpacing('lowercase', 'normal')).toBe('-0.015em');
  expect(lyricLetterSpacing('uppercase', 'normal')).toBe('0.02em');
});

it('moves with the church\'s spacing, but never past tight', () => {
  expect(lyricLetterSpacing('none', 'airy')).toBe('0.04em');
  expect(lyricLetterSpacing('none', 'tight')).toBe('-0.035em');
  expect(lyricLetterSpacing('uppercase', 'tight')).toBe('-0.015em');
});
