import { expect, it } from 'vitest';
import { arrangeSongCards, editSongCard, songCards } from './songCards';

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

it('moves and deletes exactly one visible card without losing neighboring lyrics',()=>{
 const sections=[{label:'Verse',lines:['a','b','c','d','e','f']},{label:'Chorus',lines:['g']}];
 expect(arrangeSongCards(sections,0,2).map(s=>s.lines)).toEqual([['e','f'],['g'],['a','b','c','d']]);
 expect(arrangeSongCards(sections,1,null).map(s=>s.lines)).toEqual([['a','b','c','d'],['g']]);
 expect(sections[0].lines).toHaveLength(6);
 expect(()=>arrangeSongCards([{label:'Only',lines:['a']}],0,null)).toThrow('at least one');
 expect(()=>arrangeSongCards(sections,-1,null)).toThrow('no longer');
});
