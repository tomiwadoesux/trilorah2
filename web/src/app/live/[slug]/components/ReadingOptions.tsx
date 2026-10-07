"use client";
import { useEffect, useRef, useState } from "react";

export interface ReadingAppearance { image: string; size: number; aurora: string }
const DEFAULT: ReadingAppearance = {image:"",size:21,aurora:"fern"};

export default function ReadingOptions({churchId,onChange}:{churchId:string;onChange:(value:ReadingAppearance)=>void}) {
  const [value,setValue]=useState(DEFAULT);
  const [open,setOpen]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const key=`trilorah-reading:${churchId}`;
  useEffect(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem(key)||'null');
      const next={aurora:['fern','iris','tide','ember','rose'].includes(saved?.aurora)?saved.aurora:'fern',size:Math.max(18,Math.min(30,Number(saved?.size)||21)),image:typeof saved?.image==='string'&&saved.image.startsWith('data:image/jpeg;base64,')?saved.image:''};
      setValue(next);onChange(next);
    }catch{setValue(DEFAULT);onChange(DEFAULT);}
  },[key,onChange]);
  function update(next:ReadingAppearance){
    setValue(next);onChange(next);
    try{localStorage.setItem(key,JSON.stringify(next));setError('');}
    catch{setError('Applied for now. This browser could not save your reading preferences.');}
  }
  async function choose(file:File|undefined){
    if(!file)return;
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>12*1024*1024){setError('Choose a JPG, PNG or WebP image smaller than 12 MB.');return;}
    setLoading(true);setError('');
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();image.src=url;await image.decode();
      const scale=Math.min(1,1400/Math.max(image.width,image.height));
      const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
      const context=canvas.getContext('2d');if(!context)throw Error('Image processing is unavailable.');
      context.drawImage(image,0,0,canvas.width,canvas.height);
      update({...value,image:canvas.toDataURL('image/jpeg',.8)});
    }catch{setError('This image could not be opened. Try another one.');}
    finally{URL.revokeObjectURL(url);setLoading(false);if(input.current)input.current.value='';}
  }
  return <div className="reading-options">
    <button ref={trigger} className="reading-options-trigger" aria-expanded={open} aria-controls="reading-options-panel" onClick={()=>setOpen(!open)}>Aa <span>Reading options</span></button>
    {open&&<section id="reading-options-panel" aria-label="Reading options" onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}}}>
      <div className="reading-options-heading"><h2>Make yourself comfortable</h2><button onClick={()=>{setOpen(false);trigger.current?.focus();}} aria-label="Close reading options">×</button></div>
      <label htmlFor="reading-size">Text size <span>{value.size}px</span></label>
      <input id="reading-size" type="range" min="18" max="30" step="1" value={value.size} onChange={e=>update({...value,size:Number(e.target.value)})}/>
      <fieldset className="reading-colours"><legend>App colour</legend>{['fern','iris','tide','ember','rose'].map(colour=><button key={colour} type="button" data-aurora={colour} aria-pressed={value.aurora===colour} onClick={()=>update({...value,aurora:colour})}>{colour}</button>)}</fieldset>
      <p>Background on this phone</p><small>Your image stays in this browser. A gentle dark overlay always keeps the words readable.</small>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>void choose(e.target.files?.[0])}/>
      <div className="reading-options-actions"><button disabled={loading} onClick={()=>input.current?.click()}>{loading?'Opening image…':'Choose image'}</button><button disabled={!value.image||loading} onClick={()=>update({...value,image:''})}>Remove image</button></div>
      {error&&<p role="alert">{error}</p>}
    </section>}
  </div>;
}
