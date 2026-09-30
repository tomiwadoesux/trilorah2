import { expect, it } from 'vitest';
import { editSongCard, songCards } from './songCards';

it('keeps every lyric in order while limiting each live card to four lines', () => {
  const lines=['one','two','three','four','five','six'];
  const cards=songCards({id:'hymn',sections:[{label:'Verse 1',lines},{label:'Chorus',lines:['chorus']}]});
  expect(cards.map(c=>c.lines)).toEqual([lines.slice(0,4),lines.slice(4),['chorus']]);
  expect(cards.map(c=>[c.sectionIndex,c.offset])).toEqual([[0,0],[0,4],[1,0]]);
  expect(new Set(cards.map(c=>c.id)).size).toBe(3);
  expect(cards[1].id).toBe('hymn/hymn:0/page-1');
});
it('gives an empty section an editable card', () => {
  expect(songCards({id:'hymn',sections:[{label:'Verse',lines:[]}]})).toHaveLength(1);
});

it('edits one card without dropping its remaining lyrics or other sections', () => {
  const sections=[{label:'Verse 1',lines:['a','b','c','d','e','f']},{label:'Chorus',lines:['chorus']}];
  expect(editSongCard(sections,0,0,4,['new line'])).toEqual([{label:'Verse 1',lines:['new line','e','f']},sections[1]]);
  expect(editSongCard(sections,0,4,2,['new ending'])).toEqual([{label:'Verse 1',lines:['a','b','c','d','new ending']},sections[1]]);
  expect(()=>editSongCard(sections,0,0,0,['new line'])).toThrow('changed');
  expect(sections[0].lines).toHaveLength(6);
});
