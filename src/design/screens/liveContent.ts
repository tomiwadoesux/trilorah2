/*
 * S-02 LIVE — content and states, parked.
 *
 * The screen is a bare skeleton right now: the owner asked for the layout
 * with no text in it, so this is everything the panels used to say, kept
 * intact and one import away. Nothing renders it today. It is here rather
 * than in git history so the fourteen states stay readable while the
 * composition is being settled.
 */

import type { ShellModel } from './AppShell';

export interface Verse {
  ref: string;
  version: string;
  text: string;
}

export type Source = 'auto' | 'operator' | 'correction';

export interface LiveModel {
  shell: ShellModel;
  listening: boolean;
  mic: 'ok' | 'silent' | 'denied';
  level: number;
  auto: boolean;
  trust: number;
  transcript: { text: string; partial?: boolean; hit?: boolean }[];
  transcriptNote?: string;
  preview: (Verse & { intent?: string; source?: Source }) | null;
  live: (Verse & { source?: Source }) | null;
  output: 'live' | 'frozen' | 'cleared' | 'black' | 'logo' | 'media' | 'qr';
  display: 'connected' | 'none';
  queue: { ref: string; note?: string }[];
  log: { time: string; text: string; kind: Source | 'system' }[];
}

export const SERVICE = [
  { name: 'Welcome & Notices', meta: '5 min', done: true },
  { name: 'Great Is Thy Faithfulness', meta: 'song · 4 slides', done: true },
  { name: 'Opening Prayer', meta: '3 min', done: true },
  { name: 'Romans 8:28–39', meta: 'reading', done: true },
  { name: 'The Weight of Glory', meta: 'sermon · 35 min', active: true },
  { name: 'In Christ Alone', meta: 'song · 5 slides' },
  { name: 'Benediction', meta: '2 min' },
];

export const ROM: Verse = {
  ref: 'Romans 8:28',
  version: 'NIV',
  text: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.',
};

export const COR: Verse = {
  ref: '2 Corinthians 4:17',
  version: 'NIV',
  text: 'For our light and momentary troubles are achieving for us an eternal glory that far outweighs them all.',
};

export const COR34: Verse = {
  ref: '2 Corinthians 4:34',
  version: 'NIV',
  text: 'So we fix our eyes not on what is seen, but on what is unseen, since what is seen is temporary, but what is unseen is eternal.',
};

export const QUEUE = [
  { ref: '2 Corinthians 4:18', note: 'next in passage' },
  { ref: 'Psalm 73:26' },
  { ref: 'Isaiah 40:31', note: 'from notes' },
];

export const LOG: LiveModel['log'] = [
  { time: '10:42', text: 'Romans 8:28 pushed live', kind: 'operator' },
  { time: '10:39', text: '2 Corinthians 4:17 proposed', kind: 'auto' },
  { time: '10:31', text: 'service started · Pastor Ade', kind: 'system' },
];

export const BASE: LiveModel = {
  shell: { tab: 'LIVE', engine: 'connected' },
  listening: true,
  mic: 'ok',
  level: 0.55,
  auto: false,
  trust: 0.82,
  transcript: [
    { text: 'and Paul says something remarkable here about suffering' },
    { text: 'our light and momentary troubles — turn with me to second Corinthians four seventeen', hit: true },
    { text: 'because what he is comparing is not', partial: true },
  ],
  preview: null,
  live: null,
  output: 'cleared',
  display: 'connected',
  queue: QUEUE,
  log: LOG,
};

export const s = (over: Partial<LiveModel>): LiveModel => ({ ...BASE, ...over });

export const STATES: Record<string, LiveModel> = {
  'S-02a': s({ listening: false, level: 0, transcript: [], transcriptNote: 'press listen to start transcribing', log: LOG.slice(2) }),
  'S-02b': s({ listening: false, level: 0, transcript: [], transcriptNote: 'connecting to the transcriber — whisper model 61%', log: [{ time: '10:30', text: 'downloading whisper model (small.en)', kind: 'system' }] }),
  'S-02c': s({}),
  'S-02d': s({ preview: { ...COR, intent: 'quoting', source: 'auto' } }),
  'S-02e': s({ live: { ...COR, source: 'operator' }, output: 'live', log: [{ time: '10:44', text: '2 Corinthians 4:17 pushed live', kind: 'operator' }, ...LOG] }),
  'S-02f': s({ auto: true, trust: 0.91, live: { ...COR, source: 'auto' }, output: 'live', log: [{ time: '10:44', text: '2 Corinthians 4:17 — auto (trust 0.91)', kind: 'auto' }, ...LOG] }),
  'S-02g': s({
    live: { ...COR, source: 'operator' },
    output: 'live',
    preview: { ...COR34, intent: 'correction', source: 'correction' },
    transcript: [
      { text: 'our light and momentary troubles — second Corinthians four seventeen', hit: true },
      { text: 'sorry, I meant verse thirty four', hit: true },
    ],
    log: [{ time: '10:45', text: 'heard "I meant verse 34" — swapped to 4:34', kind: 'correction' }, ...LOG],
  }),
  'S-02h': s({ shell: { tab: 'LIVE', engine: 'connected', mode: 'prayer' }, listening: false, level: 0, output: 'black', transcriptNote: 'transcription paused for prayer', transcript: [] }),
  'S-02i': s({
    shell: { tab: 'LIVE', engine: 'connected', mode: 'practice', banner: { tone: 'info', text: 'practice mode — nothing you push reaches the projector' } },
    preview: { ...COR, intent: 'quoting', source: 'auto' },
  }),
  'S-02j': s({ live: { ...ROM, source: 'operator' }, output: 'frozen' }),
  'S-02k': s({ output: 'qr', live: null, log: [{ time: '10:47', text: 'companion QR on output', kind: 'operator' }, ...LOG] }),
  'S-02l': s({
    shell: { tab: 'LIVE', engine: 'error', banner: { tone: 'danger', text: 'the engine stopped responding — transcription is down. manual push still works. restart engine' } },
    listening: false, level: 0, mic: 'silent', transcript: [],
    transcriptNote: 'transcription unavailable — the engine is not responding',
    live: { ...ROM, source: 'operator' }, output: 'frozen',
  }),
  'S-02m': s({
    display: 'none', output: 'cleared',
    shell: { tab: 'LIVE', engine: 'connected', banner: { tone: 'warn', text: 'no second display detected — connect a projector or open the output window manually' } },
    preview: { ...COR, intent: 'quoting', source: 'auto' },
  }),
  'S-02n': s({
    mic: 'denied', level: 0, listening: false, transcript: [],
    transcriptNote: 'no signal from the microphone for 40 seconds',
    shell: { tab: 'LIVE', engine: 'connected', banner: { tone: 'danger', text: 'microphone access denied — trilorah cannot hear anything. open system settings' } },
  }),
};
