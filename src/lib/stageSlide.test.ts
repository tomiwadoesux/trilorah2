import { expect, it } from 'vitest';
import { stageSlide } from './stageSlide';
it('renders song lyrics with their line breaks in preview and live', () => {
  const slide=stageSlide({source:'song',id:'song/verse1',label:'Amazing Grace — Verse 1',title:'Amazing Grace',lines:['Amazing grace','How sweet the sound']});
  expect(slide?.reference).toBe('Amazing Grace');
  expect(slide?.lines).toEqual([{version:'',text:'Amazing grace\nHow sweet the sound'}]);
});
it('keeps scripture slides and picture-only media intact', () => {
  expect(stageSlide({source:'scripture',id:'John1:1',label:'John 1:1',text:'In the beginning'} )?.lines[0].version).toBe('KJV');
  expect(stageSlide({source:'media',id:'photo',label:'Photo',path:'/photo.png'})).toBeNull();
});
