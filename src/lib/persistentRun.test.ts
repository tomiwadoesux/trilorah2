import { expect, it } from 'vitest';
import { createPersistentRun } from './persistentRun';
import type { PersistedRun, RunSegment } from '../../shared/operatorRun';
const run: RunSegment[] = [{key:'sermon-1',type:'sermon',label:'Sermon',items:[{key:'song-1',source:'song',label:'Amazing grace',lines:['Amazing grace']}]}];
it('does not overwrite saved data on mount and saves mutations before remount', () => {
  let data: RunSegment[] | PersistedRun = run; let writes = 0;
  const storage = {read:()=>data,write:(value:PersistedRun)=>{data=value;writes++;}};
  const first = createPersistentRun(storage);
  const second = createPersistentRun(storage);
  expect(writes).toBe(0);
  first.update(previous=>[...previous,{key:'prayer-1',type:'prayer',label:'Prayer',items:[]}]);
  expect(createPersistentRun(storage).getSnapshot()).toHaveLength(2);
  expect(second.getSnapshot()).toEqual(run); // An idle instance has never saved its older snapshot.
  expect(createPersistentRun(storage).getSnapshot()[0].items[0].lines).toEqual(['Amazing grace']);
});
it('does not let late engine hydration discard current edits', async () => {
  let resolve!: (value:unknown)=>void;
  const saved:PersistedRun[]=[];
  const store=createPersistentRun({read:()=>run,write:()=>{},readDurable:()=>new Promise(r=>{resolve=r;}),writeDurable:async next=>{saved.push(next);}});
  const ready=store.hydrate(); store.update(previous=>previous.map(s=>({...s,label:'Edited sermon'})));
  resolve([]); await ready; await store.flush();
  expect(store.getSnapshot()[0].label).toBe('Edited sermon');
  expect(saved[0].segments[0].label).toBe('Edited sermon');
});
it('restores the engine copy across browser origins', async () => {
  const store=createPersistentRun({read:()=>null,write:()=>{},readDurable:async()=>run});
  await store.hydrate(); expect(store.getSnapshot()).toEqual(run);
});

it('preserves the newer local run after an interrupted engine save and restart', async () => {
  let local:unknown=null;
  const storage={read:()=>local,write:(next:PersistedRun)=>{local=next;},readDurable:async()=>({segments:[],updatedAt:1})};
  const first=createPersistentRun(storage); first.update(run);
  const reopened=createPersistentRun(storage); await reopened.hydrate();
  expect(reopened.getSnapshot()).toEqual(run);
  reopened.acceptExternal({segments:[],updatedAt:1});
  expect(reopened.getSnapshot()).toEqual(run);
});
