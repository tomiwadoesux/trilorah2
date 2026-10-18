'use client';
import { useState } from 'react';
import { Download, Upload } from '@/components/icons';

export function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function ShareActions({ title, text, filename, url, disabled = false }: { title: string; text: string; filename: string; url?: string; disabled?: boolean }) {
  const [status, setStatus] = useState('');
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title, text, ...(url ? { url } : {}) }); setStatus('Shared'); }
      else { await navigator.clipboard.writeText(`${text}${url ? `\n\n${url}` : ''}`); setStatus('Copied for sharing'); }
    } catch (error) { if ((error as Error).name !== 'AbortError') setStatus('Couldn’t share. You can download a copy.'); }
  };
  return <div className="companion-share"><div className="companion-actions">
    <button disabled={disabled} onClick={() => void share()}><Upload size={18}/>Share</button>
    <button disabled={disabled} onClick={() => { downloadText(text, filename); setStatus('Download started'); }}><Download size={18}/>Download</button>
  </div>{status && <p role="status" className="companion-small">{status}</p>}</div>;
}
