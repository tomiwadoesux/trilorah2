import { useEffect, useState } from 'react';
import { PhoneIcon } from '../ui';

export function MobileRemotePanel() {
  const [open,setOpen]=useState(false);
  const [status,setStatus]=useState<Awaited<ReturnType<WindowApi['mobileStatus']>>|null>(null);
  const [code,setCode]=useState<{code:string;expiresAt:number}|null>(null);
  const [url,setUrl]=useState('');
  const [qr,setQr]=useState('');
  const [error,setError]=useState('');
  const [needsRestart,setNeedsRestart]=useState(false);
  const api=window.api;
  const refresh=async()=>{ if (!api) return; setStatus(await api.mobileStatus()); setCode(await api.mobileCode()); };
  const reportError=(e:unknown)=>{
    const message=String(e);
    if (/No handler registered for ['"]mobile-|mobile\w+ is not a function/.test(message)) {
      setNeedsRestart(true);
      setStatus(null);
      setError('Trilorah needs a full restart to load the mobile backend. Close all Trilorah windows and reopen the app, then enable mobile access. Refreshing this window is not enough.');
    } else setError(message);
  };
  useEffect(()=>{
    if (!open || needsRestart) return;
    let disposed=false;
    let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{
      try { await refresh(); if (!disposed) timer=setTimeout(()=>void poll(),1000); }
      catch(e) { if (!disposed) reportError(e); }
    };
    void poll();
    return()=>{disposed=true;clearTimeout(timer);};
  },[open,needsRestart]);
  useEffect(()=>{ const next=status?.urls.includes(url) ? url : status?.urls[0] || ''; if(next!==url) setUrl(next); },[status,url]);
  useEffect(()=>{ setQr(''); if(url) void api?.mobileQr(url).then(setQr).catch(e=>setError(String(e))); },[url]);
  async function act(fn:()=>Promise<unknown>) { try{setError(''); await fn(); await refresh();}catch(e){reportError(e);} }
  return <>
    <button type="button" className="tri-header-control tri-header-remote flex shrink-0 items-center gap-2 lowercase" title="pair a phone as a remote" onClick={()=>setOpen(true)}><PhoneIcon size={12} className="tri-header-icon" />mobile remote</button>
    {open && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-5" onClick={()=>setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="Mobile remote" className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-neutral-700 bg-[#171918] p-6 text-white shadow-xl" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between"><h2 className="text-xl">Mobile remote</h2><button onClick={()=>setOpen(false)} aria-label="Close mobile remote">✕</button></div>
        <p className="my-3 text-sm text-neutral-300">Connect the phone and this computer to the same trusted Wi-Fi. This QR opens private controls; use Online on the remote for the congregation’s QR.</p>
        <button disabled={needsRestart || !api || !status} className="rounded bg-white px-4 py-2 text-black disabled:opacity-40" onClick={()=>void act(()=>api!.mobileEnable(!status?.running))}>{status?.running ? 'Turn off mobile access' : 'Enable mobile access'}</button>
        {status?.running && <>
          {status.urls.length>0 ? <><label className="my-3 block text-sm">Connection address<select className="mt-1 block w-full rounded bg-neutral-800 p-2" value={url} onChange={e=>setUrl(e.target.value)}>{status.urls.map(u=><option key={u}>{u}</option>)}</select></label>{qr && <img className="mx-auto rounded" width="200" height="200" alt="Scan to open private mobile controls" src={qr}/>}</> : <p className="my-3">No Wi-Fi or Ethernet address found. Connect this computer to the church network.</p>}
          <div className="my-4 flex items-center justify-between"><button className="rounded border px-3 py-2" onClick={()=>void act(()=>api!.mobileCode(true))}>Generate pairing code</button><strong className="font-mono text-2xl tracking-widest">{code?.code || '———'}</strong></div>
          <p className="text-xs text-neutral-400">Codes expire after two minutes. Scan, enter the code, then approve the phone below. If the page cannot open, allow Trilorah through Windows Firewall on Private networks and check that guest Wi-Fi does not isolate devices.</p>
          {status.pending.map(p=><div className="my-3 rounded border border-amber-500 p-3" key={p.id}><p>{p.name} requests control</p><button className="mr-4 py-2 text-green-300" onClick={()=>void act(()=>api!.mobileApprove(p.id,true))}>Approve</button><button onClick={()=>void act(()=>api!.mobileApprove(p.id,false))}>Decline</button></div>)}
        </>}
        <h3 className="mt-5 text-sm font-semibold">Paired devices</h3>
        {status?.devices.length===0 && <p className="text-sm text-neutral-400">No phones paired yet.</p>}
        {status?.devices.map(d=><div key={d.deviceId} className="flex justify-between border-b border-neutral-700 py-3 text-sm"><span>{d.deviceName}</span><button className="text-red-300" onClick={()=>void act(()=>api!.mobileRevoke(d.deviceId))}>Revoke</button></div>)}
        {(error || status?.error) && <p role="alert" className="mt-3 text-sm text-red-300">{error || status?.error}</p>}
      </section>
    </div>}
  </>;
}
