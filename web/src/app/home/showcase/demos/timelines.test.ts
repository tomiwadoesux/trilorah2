import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEMOS, stepAt } from './timelines';
const root=resolve(__dirname,'../../../../..');
const hero=JSON.parse(readFileSync(resolve(root,'public/hero-service/states.json'),'utf8'));
describe('native feature demos',()=>{
  for(const [id,demo] of Object.entries(DEMOS)) {
    it(`${id} has exported states and leaves time to read its result`,()=>{
      const pack=demo.source==='hero'?hero:JSON.parse(readFileSync(resolve(root,`public/feature-demos/${demo.source}.json`),'utf8'));
      expect(demo.steps[0].at).toBe(0);
      expect(demo.duration-demo.steps.at(-1)!.at).toBeGreaterThanOrEqual(2500);
      demo.steps.forEach((step,i)=>{expect(pack.states[step.phase]).toBeDefined();if(i)expect(step.at).toBeGreaterThan(demo.steps[i-1].at);expect(stepAt(demo,step.at)).toBe(step);});
      expect(stepAt(demo,demo.duration)).toBe(demo.steps.at(-1));
    });
  }
  it('keeps live scripture unchanged while the new verse is previewed',()=>{
    expect(hero.states['last-caught'].live).toBe(hero.states['last-staged'].live);
    expect(hero.states['last-staged'].live).not.toBe(hero.states['last-live'].live);
    expect(DEMOS.scripture.steps.find(s=>s.phase==='last-live')?.click).toBe(true);
  });
  it('requires an explicit go-live step for songs and the phone',()=>{
    expect(DEMOS.songs.steps.find(s=>s.phase==='song-live')).toMatchObject({click:true,target:'[data-guide="go-live"]'});
    expect(DEMOS.companion.steps.find(s=>s.phase==='phone-live')).toMatchObject({click:true,target:'#goLive'});
  });
  it('exports inert local documents without the app bridge',()=>{
    for(const source of ['service','screens','phone']){
      const pack=JSON.parse(readFileSync(resolve(root,`public/feature-demos/${source}.json`),'utf8'));
      for(const state of Object.values(pack.states) as {html:string}[]){expect(state.html).not.toMatch(/<script\b|\son\w+=["']|\ssrcdoc=/i);expect(state.html).not.toMatch(/(?:src|href)=["'](?:https?:|file:)/i);}
    }
  });
});
