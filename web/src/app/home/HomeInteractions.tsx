'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from '@/components/icons';
import { LineArtwork } from './LineStudio';

export { HomeNavigation } from './HomeNavigation';

const notes = [
  {title: 'A service that moves with you.', category: 'Inside Trilorah', description: 'Songs, scripture, and screens. One place to bring the whole service together.', pattern: 'orbit' as const, palette: 'forest' as const,
    paragraphs: ['A service rarely follows a perfectly straight line. A preacher returns to a passage, a song runs a little longer, or a moment calls for a different slide. Trilorah brings the run of service, scripture, and presentation into one workspace.', 'Prepare songs and media, then follow the live message from the operator view. Scripture recognition helps identify references as they are spoken, while you stay in control of what reaches the screen.', 'The congregation companion brings live verses, a transcript, and sermon notes onto a phone. Your team can focus on the room while everyone has another way to follow along.'], link: '#workspace', linkLabel: 'Explore the workspace'},
  {title: 'A thought worth taking home.', category: 'The congregation companion', description: 'Give the message a little more room, with verses and notes in everyone’s hands.', pattern: 'diamond' as const, palette: 'blue' as const,
    paragraphs: ['Sometimes a single sentence stays with you. The Trilorah companion gives those moments a place to go, with sermon notes alongside the service.', 'Your congregation opens the companion by scanning the service QR code. There is no separate app to install. Live scripture and the transcript are available in the same experience, so people can read along at their own pace.', 'The companion complements what is happening in the room. It keeps the message close, whether someone wants to check a verse, follow the words, or revisit a key point.'], link: '#companion', linkLabel: 'Meet the companion'},
  {title: 'Pack the service. Keep the details.', category: 'Portable service files', description: 'Take songs, media, and layouts with you in a single .tri file.', pattern: 'rays' as const, palette: 'amber' as const,
    paragraphs: ['A service is more than its running order. There are the songs, the background you chose, the media you prepared, and the layouts that make everything feel at home.', 'Trilorah’s .tri format keeps that preparation together. A portable package can carry the service, song lyrics, images and videos, presentations, and theme layouts. Local media is embedded so it can travel with the file.', 'Open a package in the desktop app, or choose which parts to import. You can review the contents before adding them to your library. Remote media links remain links and may still need an internet connection.'], link: '/app/signup', linkLabel: 'Get started with Trilorah'},
];

export function HomeNotes() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(0);
  const note = notes[selected];
  return (
    <section className="home-section" id="notes" aria-labelledby="notes-heading">
      <div className="home-container">
        <div className="home-notes-heading"><div><span className="home-eyebrow">Ideas, details, and a closer look</span><h2 id="notes-heading">The Trilorah notebook.</h2></div><p>A few things worth exploring <span aria-hidden="true">↘</span></p></div>
        <div className="home-news-grid">{notes.map((item, index) => <button key={item.title} className="home-news-card" type="button" aria-haspopup="dialog" onClick={() => { setSelected(index); dialog.current?.showModal(); }}><div className="home-news-image"><LineArtwork pattern={item.pattern} palette={item.palette} density={index === 0 ? 14 : 18} dotted /><span className="home-news-index">TRILORAH JOURNAL / 0{index + 1}</span></div><div className="home-news-meta">{item.category}</div><h3>{item.title}<ArrowRight size={15} /></h3><p>{item.description}</p></button>)}</div>
      </div>
      <dialog className="home-note-dialog" ref={dialog} aria-labelledby="home-note-title" onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close(); } }}>
        <button type="button" className="home-note-close" aria-label="Close article" onClick={() => dialog.current?.close()} autoFocus><X size={16} /></button><span className="home-eyebrow">{note.category}</span><h2 id="home-note-title">{note.title}</h2>{note.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<Link className="home-button home-button-primary" href={note.link} onClick={() => dialog.current?.close()}>{note.linkLabel}<ArrowRight size={16} /></Link>
      </dialog>
    </section>
  );
}
