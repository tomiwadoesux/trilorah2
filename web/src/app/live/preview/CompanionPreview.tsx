'use client';
import { useEffect, useMemo, useState } from 'react';
import { CompanionView, type CompanionViewProps, type Account } from '../[slug]/CompanionClient';
import type { Notebook } from '@/lib/companionNotebook';

// Isolated presentation fixtures. No feed, analytics, correction or cloud writes.
const started = '2026-10-11T15:00:00.000Z';
const paragraphs = [
  'Faith is more than something we agree with. It is a way of living. The invitation this morning is simple: let what you believe become visible in the way you love.',
  'Paul writes to the church in Romans twelve and asks us to offer our whole lives to God. Not just the hour we spend together on Sunday, but the ordinary moments that make up our week.',
  'A renewed mind begins with attention. What are we listening to? What are we making room for? The voice we return to will shape the person we become.',
  'James reminds us to be doers of the word. A small act of obedience matters. A conversation we have been avoiding. A neighbour we can help. A moment when we choose patience instead of having the last word.',
  'We do not have to produce this life alone. Jesus says, I am the vine, you are the branches. Remain in me. Growth begins with connection, and the fruit follows.',
  'This week, choose one next step. Write it down. Pray over it. Share it with someone who can walk with you. Let us be a people whose faith can be seen in love.'
];
let time = 0;
const samplePassages: CompanionViewProps['transcript'] = paragraphs.map((text, i) => {
  const offset = time;
  const words = text.split(' ').map(w => { const s = time; time += .43; return { w, s, e: time }; });
  time += 1.5;
  return { id: `sample-chunk-${i}`, text, is_final: true, timestamp: new Date(Date.parse(started) + offset * 1000).toISOString(), segment_type: 'sermon', words, offset_ms: offset * 1000 };
});
const cycleSeconds = time;
// Deliver short completed phrases, just after they have been "spoken". The
// reader's real five-second hold supplies the look-ahead; no future words are
// delivered to the view. Repeat the sample with an advancing service clock.
function sampleFeed(start: number, elapsed: number): CompanionViewProps['transcript'] {
  const chunks: CompanionViewProps['transcript'] = [];
  const cycle = Math.floor(elapsed / cycleSeconds);
  for (let c = Math.max(0, cycle - 1); c <= cycle; c++) {
    for (const passage of samplePassages) {
      for (let i = 0; i < passage.words!.length; i += 4) {
        const words = passage.words!.slice(i, i + 4).map(w => ({ ...w, s: w.s + c * cycleSeconds, e: w.e + c * cycleSeconds }));
        const deliveredAt = words.at(-1)!.e + .6;
        if (deliveredAt > elapsed) continue;
        chunks.push({ ...passage, id: `${passage.id}-${c}-${i}`, text: words.map(w => w.w).join(' '), words,
          offset_ms: words[0].s * 1000, timestamp: new Date(start + deliveredAt * 1000).toISOString() });
      }
    }
  }
  return chunks;
}
const seed: Notebook = { version: 1, notes: [{ serviceId: 'sample-service', title: 'A faith that moves', date: 'October 11, 2026', text: '“Let what you believe become visible in the way you love.”\n\nMy next step: make time for the conversation I’ve been putting off. Listen first.\n\nA prayer for the week: help me notice the small opportunities to serve.', updatedAt: started }], verses: [] };
export default function CompanionPreview({ account, emptyTranscript = false }: { account?: Account; emptyTranscript?: boolean } = {}) {
  const [clock, setClock] = useState<{ start: number; elapsed: number } | null>(null);
  useEffect(() => {
    const start = Date.now() - 20_000;
    const tick = () => setClock({ start, elapsed: (Date.now() - start) / 1000 });
    tick();
    if (emptyTranscript) return;
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [emptyTranscript]);
  const transcript = useMemo(() => clock && !emptyTranscript ? sampleFeed(clock.start, clock.elapsed) : [], [clock, emptyTranscript]);
  const serviceStarted = clock ? new Date(clock.start).toISOString() : started;
  return <CompanionView preview previewNotebook={seed}
    account={account ? {...account, id: `design-preview-${account.id}`} : { id: 'design-preview', name: 'Trilorah Community', slug: 'preview', giving_methods: {} }}
    service={{ id: 'sample-service', account_id: 'design-preview', preacher_id: null, started_at: serviceStarted, ended_at: null, sermon_title: 'A faith that moves', publish_transcript: true, audience_training_enabled: false, stream_url: null }}
    isLive={!!clock} loading={!clock} transcript={transcript} currentSegment="sermon" health="live" fingerprint=""
    verses={['Romans 12:1–2', 'James 1:22–25', 'John 15:5'].map((ref, i) => ({ id: `sample-verse-${i}`, ref, pushed_at: started }))}
    notes={{ title: 'A faith that moves', theme: 'Let belief become visible in everyday love.', is_live: false,
      main_points: [
        { point: 'Offer the ordinary moments.', explanation: 'Worship reaches into our habits, work and relationships. Our whole life can become a response to God.', scriptures: ['Romans 12:1–2'] },
        { point: 'Put the word into practice.', explanation: 'Choose one small act of obedience this week. Faith takes shape when we respond to what we hear.', scriptures: ['James 1:22–25'] },
        { point: 'Stay connected to the source.', explanation: 'Growth comes from remaining in Christ. Make space to listen, pray and receive before rushing to do.', scriptures: ['John 15:5'] },
      ], applications: ['Name one conversation, habit or act of service you can begin this week.', 'Write it down and pray about it each morning.'], memorable_quotes: ['Let what you believe become visible in the way you love.'], all_scriptures: ['Romans 12:1–2', 'James 1:22–25', 'John 15:5'], definitions: [] }}/>
}
