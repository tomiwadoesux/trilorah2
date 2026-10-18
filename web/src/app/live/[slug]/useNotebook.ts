'use client';
import { useEffect, useRef, useState } from 'react';
import { decodeNotebook, emptyNotebook, type Notebook } from '@/lib/companionNotebook';

export function useNotebook(accountId: string, seed?: Notebook) {
  const key = `trilorah-notebook-v1:${accountId}`;
  const [book, setBook] = useState<Notebook>(emptyNotebook);
  const current = useRef(book);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      current.current = stored ? decodeNotebook(stored) : seed ?? emptyNotebook();
      setBook(current.current);
      setStatus('Saved on this device');
      setReady(true);
    } catch { setStatus('This browser couldn’t open your notebook. Download a copy of anything you write.'); setReady(true); }
  }, [key, seed]);
  // Read the latest stored value before each edit, so separate tabs retain
  // one another's notes and bookmarks. A damaged store is never overwritten.
  const update = (change: (previous: Notebook) => Notebook) => {
    let previous = current.current;
    try { const raw = localStorage.getItem(key); if (raw) previous = decodeNotebook(raw); } catch {
      const next = change(previous); current.current = next; setBook(next);
      setStatus('Not saved. Download your notes before closing this page.'); return;
    }
    const next = change(previous); current.current = next; setBook(next);
    try { localStorage.setItem(key, JSON.stringify(next)); setStatus('Saved on this device'); }
    catch { setStatus('Not saved. Device storage is full or unavailable. Download your notes.'); }
  };
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key !== key) return;
      try { const next = decodeNotebook(event.newValue); current.current = next; setBook(next); }
      catch { setStatus('Your notebook changed in another tab but couldn’t be opened.'); }
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [key]);
  return { book, update, ready, status };
}
export type NotebookController = ReturnType<typeof useNotebook>;
