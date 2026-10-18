export type DemoId = 'scripture' | 'songs' | 'service' | 'screens' | 'companion';
export type Crop = { x:number; y:number; width:number; height:number };
export type Step = { at:number; phase:string; label:string; target?:string; pane?:'front'|'back'; click?:boolean; targetIndex?:number };
export type Demo = { source:'hero'|'service'|'screens'|'phone'; duration:number; front:Crop; back:Crop; steps:Step[] };
const workspace={x:310,y:52,width:1285,height:883};
export const DEMOS:Record<DemoId,Demo> = {
  scripture:{source:'hero',duration:15500,front:{x:10,y:57,width:290,height:386},back:workspace,steps:[
    {at:0,phase:'last-caught',label:'Listening to the message'},
    {at:3400,phase:'last-caught',label:'Psalm 46:10 caught',target:'.catch-spot.is-pressable',pane:'back'},
    {at:4200,phase:'last-staged',label:'The verse waits in preview',target:'.catch-spot.is-pressable',pane:'back',click:true},
    {at:7400,phase:'last-staged',label:'Ready when you are',target:'[data-guide="go-live"]',pane:'back'},
    {at:8250,phase:'last-live',label:'Go live — now on screen',target:'[data-guide="go-live"]',pane:'back',click:true},
    {at:11000,phase:'last-live',label:'The congregation sees Psalm 46:10'},
  ]},
  songs:{source:'hero',duration:14900,front:{x:1242.5,y:512.375,width:352.5,height:240},back:workspace,steps:[
    {at:0,phase:'song-ready',label:'Listen to what the room is singing'},
    {at:2400,phase:'song-found',label:'Amazing Grace found'},
    {at:4300,phase:'song-found',label:'Choose the lyric card',target:'.catch-spot.is-song',pane:'front'},
    {at:5000,phase:'song-staged',label:'Lyrics ready in preview',target:'.catch-spot.is-song',pane:'front',click:true},
    {at:7600,phase:'song-staged',label:'Send the prepared verse',target:'[data-guide="go-live"]',pane:'back'},
    {at:8400,phase:'song-live',label:'The lyrics are live',target:'[data-guide="go-live"]',pane:'back',click:true},
    {at:11300,phase:'song-live',label:'Amazing Grace · Verse 1'},
  ]},
  service:{source:'service',duration:16800,front:{x:304,y:174.5,width:310,height:578.5},back:{x:290,y:90,width:1020,height:760},steps:[
    {at:0,phase:'service-start',label:'Build the service in running order'},
    {at:1700,phase:'service-start',label:'Open the saved song library',target:'[data-guide="run-add-items"]',pane:'back'},
    {at:2500,phase:'service-picker',label:'Choose a lyric card'},
    {at:5100,phase:'service-picker',label:'Add Amazing Grace · Verse 2',target:'[title="Add Amazing Grace — Verse 2"]',pane:'back'},
    {at:5800,phase:'service-added',label:'Both verses are in the service',target:'[title="Preview Amazing Grace — Verse 2"]',click:true,pane:'back'},
    {at:9000,phase:'service-added',label:'Move Images earlier in the schedule',target:'[aria-label="Select Images, section 3"]',pane:'front'},
    {at:10000,phase:'service-arranged',label:'The running order is updated',target:'[aria-label="Select Images, section 2"]',pane:'front',click:true},
    {at:13200,phase:'service-arranged',label:'Songs, scripture, images and slides together'},
  ]},
  screens:{source:'screens',duration:15400,front:{x:480,y:160,width:640,height:620},back:{x:6,y:348,width:393,height:319},steps:[
    {at:0,phase:'screens-settings',label:'A separate job for every screen'},
    {at:2700,phase:'screens-settings',label:'Choose the stage display',target:'[data-guide="outputs-settings"] button[aria-haspopup="listbox"]',targetIndex:2,pane:'front'},
    {at:3500,phase:'screens-picker',label:'Select where the stage output appears',click:true,pane:'front'},
    {at:6500,phase:'screens-off',label:'No screen closes this output'},
    {at:9200,phase:'screens-assigned',label:'Dell P2419H assigned to the stage',click:true,pane:'front'},
    {at:12200,phase:'screens-assigned',label:'Projector, stream and stage keep their own roles'},
  ]},
  companion:{source:'phone',duration:15700,front:{x:0,y:0,width:390,height:844},back:{x:16,y:66,width:358,height:184},steps:[
    {at:0,phase:'phone-start',label:'Your paired phone is ready'},
    {at:2000,phase:'phone-start',label:'Tap a caught verse',target:'#proposals button',pane:'front'},
    {at:2750,phase:'phone-preview',label:'Psalm 23:3 waits in preview',target:'#proposals button',pane:'front',click:true},
    {at:6200,phase:'phone-preview',label:'Send it from your phone',target:'#goLive',pane:'front'},
    {at:6900,phase:'phone-live',label:'Psalm 23:3 is now on screen',target:'#goLive',pane:'front',click:true},
    {at:10500,phase:'phone-live',label:'Clear the screen',target:'#clearScreen',pane:'front'},
    {at:11200,phase:'phone-clear',label:'The verse is hidden from the room',target:'#clearScreen',pane:'front',click:true},
  ]},
};
export function stepAt(demo:Demo,time:number):Step { return [...demo.steps].reverse().find(step=>step.at<=time) ?? demo.steps[0]; }
