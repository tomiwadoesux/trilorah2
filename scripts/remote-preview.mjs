// Preview the phone remote with realistic service data, without the desktop app.
//
//   node scripts/remote-preview.mjs        → http://localhost:4777/remote
//
// Serves the real public/mobile-remote.html (re-read on every load, so edits show
// on refresh) and answers its /api commands from an in-memory service: a verse on
// screen, three catches, songs (invented lyrics only — never real ones), a deck,
// timers. Open it in a browser at phone size. /mock?k=prompt shows the sermon
// question; /mock?k=screen&v=black etc. tweak state. Nothing here touches the
// engine, the projector or the cloud — the real end-to-end check is
// scripts/mobile-smoke.cjs.

import http from 'node:http';
import fs from 'node:fs';
const PAGE = new URL('../public/mobile-remote.html', import.meta.url);
const PORT = Number(process.env.PORT || 4777);

const KJV = {
  'Psalms 23:1': 'The LORD is my shepherd; I shall not want.',
  'Psalms 23:2': 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.',
  'Psalms 23:3': 'He restoreth my soul: he leadeth me in the paths of righteousness for his name’s sake.',
  'Psalms 23:4': 'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.',
  'Romans 8:28': 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.',
  'Hebrews 11:1': 'Now faith is the substance of things hoped for, the evidence of things not seen.',
  'John 3:16': 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
  'John 3:17': 'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.',
};
const verseItem = (ref, version = 'KJV') => ({ source: 'scripture', id: `${ref}@${version}`, label: ref, reference: ref, version, text: KJV[ref] || 'Verse text.' });
// Invented lyrics only.
const songs = [
  { id: 'song-morning', title: 'Morning Light', sections: [
    { label: 'Verse 1', lines: ['Morning light across the valley', 'Every shadow running home', 'You have called me by my name', 'And I am not alone'] },
    { label: 'Chorus', lines: ['Lift it higher, lift it higher', 'Let the whole house sing', 'You are faithful, You are faithful', 'Over everything'] },
    { label: 'Verse 2', lines: ['When the river rises round me', 'I will stand upon Your word', 'Every promise You have spoken', 'Is the sweetest sound I’ve heard'] },
    { label: 'Bridge', lines: ['Open up the heavens', 'Let Your glory fall', 'Open up the heavens', 'You are all in all', 'Here we are, here we are', 'Hands lifted high'] },
  ] },
  { id: 'song-anchor', title: 'Anchor Holds', sections: [{ label: 'Verse 1', lines: ['When the storm is loud', 'And the night is long'] }, { label: 'Chorus', lines: ['My anchor holds', 'My anchor holds'] }] },
  { id: 'song-rest', title: 'Quiet Waters', sections: [{ label: 'Verse 1', lines: ['Lead me to the quiet waters', 'Where my weary soul can rest'] }] },
];
const s = {
  sermon: { status: 'active', evidence: [] }, aurora: 'fern', songSearchActive: false, songMatches: [],
  run: [{ label: 'Worship', items: [{ key: 'r1', label: 'Morning Light', source: 'song' }, { key: 'r2', label: 'Anchor Holds', source: 'song' }] },
        { label: 'Word', items: [{ key: 'r3', label: 'Psalms 23:1-4', source: 'scripture' }, { key: 'r4', label: 'Sermon notes', source: 'note' }] },
        { label: 'Announcements', items: [{ key: 'r5', label: 'Welcome slides', source: 'presentation' }] }],
  preview: null, live: verseItem('Psalms 23:1'), screen: 'live', asr: 'listening', asrMessage: 'listening — Deepgram',
  proposals: [
    { id: 'p1', reference: 'Psalms 23:3', version: 'KJV', text: KJV['Psalms 23:3'], missing: false },
    { id: 'p2', reference: 'Romans 8:28', version: 'KJV', text: KJV['Romans 8:28'], missing: false, recognition: { source: 'quote' } },
    { id: 'p3', reference: 'Hebrews 11:1', version: 'KJV', text: KJV['Hebrews 11:1'], missing: false, recognition: { source: 'story' } },
  ],
  sharing: true, cloudReady: true,
  timers: [{ id: 't1', name: 'Sermon', state: 'running', display: '31:42' }, { id: 't2', name: 'Offering', state: 'stopped', display: '5:00' }],
};
const library = { songs, decks: [{ id: 'deck-welcome', title: 'Welcome slides', count: 7 }, { id: 'deck-give', title: 'Giving', count: 2 }],
  versions: ['KJV', 'BBE', 'RVR'], theme: {}, media: [], books: ['Genesis', 'Exodus', 'Psalms', 'John', 'Romans', 'Hebrews'], run: s.run };
const cards = (song) => song.sections.flatMap((sec, i) => { const n = Math.max(1, Math.ceil(sec.lines.length / 4)); return Array.from({ length: n }, (_, p) => ({ id: `${song.id}/${song.id}:${i}/page-${p}`, i, offset: p * 4, label: n > 1 ? `${sec.label} · ${p + 1}` : sec.label, lines: sec.lines.slice(p * 4, p * 4 + 4) })); });
const slideSvg = (n, title) => 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#173d3e"/><stop offset="1" stop-color="#3a2f22"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><text x="48" y="190" fill="#fff" font-family="Georgia" font-size="44">${title}</text><text x="48" y="236" fill="#ffffffaa" font-family="Arial" font-size="20">Slide ${n}</text></svg>`).toString('base64');

function step(delta) {
  const live = s.live; if (!live) throw new Error('Nothing is live.');
  if (live.source === 'scripture') { const m = /^(.+) (\d+):(\d+)$/.exec(live.reference); const next = `${m[1]} ${m[2]}:${Number(m[3]) + delta}`; s.live = verseItem(next); s.preview = s.live; return; }
  if (live.source === 'song') { const song = songs.find((x) => live.id.startsWith(x.id)); const all = cards(song); const at = all.findIndex((c) => c.id === live.id); const c = all[at + delta]; if (!c) throw new Error(delta > 0 ? 'Last lyric card reached.' : 'First lyric card reached.'); s.live = { source: 'song', id: c.id, label: `${song.title} · ${c.label}`, lines: c.lines }; s.preview = s.live; return; }
  if (live.source === 'presentation') { const [id, n] = live.id.split(':'); const k = Number(n) + delta; if (k < 0) throw new Error('This is the first slide.'); s.live = { source: 'presentation', id: `${id}:${k}`, label: `Welcome slides · ${k + 1}` }; s.preview = s.live; }
}
function run(command, a) {
  switch (command) {
    case 'state': return s;
    case 'library': return library;
    case 'thumbnail': { const it = a.target === 'live' ? s.live : s.preview; return it?.source === 'presentation' ? slideSvg(Number(it.id.split(':')[1]) + 1, 'Welcome home') : null; }
    case 'suggest': { const q = String(a.query || '').toLowerCase(); return Object.keys(KJV).filter((r) => r.toLowerCase().startsWith(q) || r.toLowerCase().replace('psalms', 'psalm').startsWith(q)).map((r) => ({ label: r, value: r, detail: KJV[r], complete: true })); }
    case 'verse': { const it = verseItem(String(a.reference).replace(/^psalm /i, 'Psalms ')); s.preview = it; if (a.live) s.live = it; return true; }
    case 'proposal': { const p = s.proposals.find((x) => x.id === a.id); if (!p) throw new Error('This detected scripture is no longer available.'); if (a.dismiss) s.proposals = s.proposals.filter((x) => x !== p); else s.preview = verseItem(p.reference); return true; }
    case 'live': { if (!s.preview) throw new Error('Select something for preview first.'); if (a.id !== s.preview.id) throw new Error('The desktop preview changed.'); s.live = s.preview; s.screen = s.screen === 'clear' ? 'live' : s.screen; return true; }
    case 'step': step(a.delta === -1 ? -1 : 1); return true;
    case 'screen': s.screen = a.value; return true;
    case 'song': { const song = songs.find((x) => x.id === a.id); const c = cards(song).find((x) => x.i === (a.index || 0) && x.offset === (a.offset || 0)); const it = { source: 'song', id: c.id, label: `${song.title} · ${c.label}`, lines: c.lines }; s.preview = it; if (a.live) s.live = it; return true; }
    case 'deck': s.preview = { source: 'presentation', id: `${a.id}:${a.index}`, label: `${library.decks.find((d) => d.id === a.id).title} · ${a.index + 1}` }; return true;
    case 'run': return true;
    case 'listen': s.asr = a.enabled ? 'listening' : 'idle'; s.asrMessage = a.enabled ? 'listening — Deepgram' : ''; return true;
    case 'song-search': s.songSearchActive = !!a.enabled; s.songMatches = a.enabled ? [{ id: 'song-morning', title: 'Morning Light', index: 1, lines: songs[0].sections[1].lines }] : []; return true;
    case 'sermon': s.sermon = { status: a.action === 'end' ? 'watching' : 'active', evidence: [] }; return true;
    case 'timer': { if (a.action === 'create') { const t = { id: 't' + Date.now(), name: a.name || 'Service timer', state: 'stopped', display: `${Math.round(a.seconds / 60)}:00` }; s.timers.push(t); return t; } const t = s.timers.find((x) => x.id === a.id); if (t) t.state = a.action === 'start' ? 'running' : a.action === 'pause' ? 'paused' : 'stopped'; return true; }
    case 'alert': case 'openOutput': case 'qr': return true;
    default: throw new Error('Unsupported remote command');
  }
}
setInterval(() => { const t = s.timers[0]; if (t.state === 'running') { const [m, sec] = t.display.split(':').map(Number); const total = m * 60 + sec + 1; t.display = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; } }, 1000);
// Control hooks for screenshots: /mock?set=... (GET) tweaks state.
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && (url.pathname === '/remote' || url.pathname === '/')) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(PAGE, 'utf8')); return; }
  if (req.method === 'GET' && url.pathname === '/mock') { const k = url.searchParams.get('k'), v = url.searchParams.get('v'); if (k === 'prompt') s.sermon = { status: 'confirmation', requestId: 1, evidence: ['“turn with me to”', 'long pause in worship'] }; else if (k === 'screen') s.screen = v; else if (k === 'aurora') s.aurora = v; else if (k === 'deck') { s.live = { source: 'presentation', id: 'deck-welcome:0', label: 'Welcome slides · 1' }; s.preview = null; } else if (k === 'verse') { s.live = verseItem(v); s.preview = null; } res.end('ok'); return; }
  let raw = ''; for await (const c of req) raw += c; const body = raw ? JSON.parse(raw) : {};
  const reply = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (url.pathname === '/api/pair') return reply(200, { id: 'pending-1' });
  if (url.pathname === '/api/pair-status') return reply(200, { token: 'mock-token' });
  if (url.pathname === '/api/command') { try { await new Promise((r) => setTimeout(r, 40)); return reply(200, { result: run(body.command, body.args || {}) }); } catch (e) { return reply(400, { error: e.message }); } }
  reply(404, { error: 'Not found' });
}).listen(PORT, '127.0.0.1', () => console.log('mock desktop on http://localhost:' + PORT + '/remote'));
