"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "@/components/icons";

export interface ReadingAppearance { image: string; size: number; aurora: string }
export const DEFAULT_READING_APPEARANCE: ReadingAppearance = {image:"/hero-landscape/dark.webp",size:27,aurora:"fern"};
const DEFAULT = DEFAULT_READING_APPEARANCE;

export default function ReadingOptions({churchId,onChange}:{churchId:string;onChange:(value:ReadingAppearance)=>void}) {
  const [value,setValue]=useState(DEFAULT);
  const [open,setOpen]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const key=`trilorah-reading:${churchId}`;
  useEffect(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem(key)||'null');
      const next={aurora:['fern','iris','tide','ember','rose'].includes(saved?.aurora)?saved.aurora:'fern',size:Math.max(18,Math.min(36,Number(saved?.size)||27)),image:typeof saved?.image==='string'&&saved.image.startsWith('data:image/jpeg;base64,')?saved.image:saved?.version===2&&saved.image===''?'':DEFAULT.image};
      setValue(next);onChange(next);
    }catch{setValue(DEFAULT);onChange(DEFAULT);}
  },[key,onChange]);
  useEffect(()=>{
    const panel=dialog.current;
    if(!panel)return;
    if(open&&!panel.open)panel.showModal();
    if(!open&&panel.open)panel.close();
  },[open]);
  function update(next:ReadingAppearance){
    setValue(next);onChange(next);
    try{localStorage.setItem(key,JSON.stringify({...next,version:2}));setError('');}
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
    <button ref={trigger} type="button" className="reading-options-trigger" aria-label="Reading options" aria-haspopup="dialog" aria-expanded={open} aria-controls="reading-options-panel" onClick={()=>setOpen(true)}>Aa <span>Reading options</span></button>
    <dialog ref={dialog} id="reading-options-panel" className="reading-dialog" aria-labelledby="reading-options-title" onClose={()=>{setOpen(false);trigger.current?.focus();}} onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
      <div className="reading-options-panel">
      <div className="reading-options-heading"><h2 id="reading-options-title">Reading options</h2><button type="button" onClick={()=>setOpen(false)} aria-label="Close reading options"><X size={20}/></button></div>
      <label htmlFor="reading-size">Text size <span>{value.size}px</span></label>
      <input id="reading-size" type="range" min="18" max="36" step="1" value={value.size} onChange={e=>update({...value,size:Number(e.target.value)})}/>
      <fieldset className="reading-colours"><legend>App colour</legend>{['fern','iris','tide','ember','rose'].map(colour=><button key={colour} type="button" data-aurora={colour} aria-pressed={value.aurora===colour} onClick={()=>update({...value,aurora:colour})}>{colour}</button>)}</fieldset>
      <p>Background on this device</p><small>Your image stays in this browser. A dark overlay is applied; choose a quiet image for comfortable reading.</small>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>void choose(e.target.files?.[0])}/>
      <div className="reading-options-actions"><button type="button" disabled={loading} onClick={()=>input.current?.click()}>{loading?'Opening image…':'Choose image'}</button><button type="button" disabled={!value.image||loading} onClick={()=>update({...value,image:''})}>Remove image</button><button type="button" disabled={value.image===DEFAULT.image||loading} onClick={()=>update({...value,image:DEFAULT.image})}>Use default</button></div>
      {error&&<p role="alert">{error}</p>}
      </div>
    </dialog>
  </div>;
}
