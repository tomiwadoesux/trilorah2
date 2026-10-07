import { create } from 'zustand';
import type { PhoneMicMessage, PhoneMicStatus } from '../../shared/phoneMic';

/*
 * The laptop's end of the phone-microphone call.
 *
 * Main (electron/mic/phoneMicLink.ts) makes the code and approves the phone;
 * this answers the phone's WebRTC offer and keeps the stream it sends, which
 * micCapture then feeds to the engine exactly as it would a USB mic. The
 * audio crosses the church Wi-Fi peer to peer; nothing here goes online.
 */

const IDLE: PhoneMicStatus = { state: 'idle', code: null, url: null, qr: null, phoneName: null, expiresAt: null, error: null };

export const usePhoneMicStore = create<{ status: PhoneMicStatus; level: number }>(() => ({ status: IDLE, level: 0 }));

let pc: RTCPeerConnection | null = null;
let stream: MediaStream | null = null;
/* Chromium only decodes a remote track that something is "playing"; a muted
   element is enough. Without it the AudioContext source stays silent. */
let sink: HTMLAudioElement | null = null;
let meter: { ctx: AudioContext; timer: number } | null = null;
let queued: RTCIceCandidateInit[] = [];
/* The phone opens a "words" channel on the same call; the laptop sends what
   it hears and what it caught down it — no cloud, so it lands as it is said. */
let words: RTCDataChannel | null = null;
let offWords: (() => void)[] = [];

const refOf = (d: { book: string; chapter: number; verse: number | null; endVerse?: number | null }) =>
  `${d.book} ${d.chapter}${d.verse ? `:${d.verse}${d.endVerse && d.endVerse !== d.verse ? `–${d.endVerse}` : ''}` : ''}`;

function sendWords(message: unknown): void {
  if (words?.readyState === 'open') {
    try { words.send(JSON.stringify(message)); } catch { /* the channel is closing */ }
  }
}

function watchWords(channel: RTCDataChannel): void {
  const api = window.api;
  words = channel;
  offWords.forEach((off) => off());
  offWords = [
    api?.onTranscriptLine?.((line) => sendWords({ kind: 'line', text: line.text, final: line.isFinal })) ?? (() => undefined),
    api?.onVersePreview?.((d) => sendWords({ kind: 'verse', ref: refOf(d), live: false })) ?? (() => undefined),
    api?.onVerseDetected?.((d) => sendWords({ kind: 'verse', ref: refOf(d), live: true })) ?? (() => undefined),
    api?.onShowCleanBackground?.(() => sendWords({ kind: 'verse', ref: null, live: true })) ?? (() => undefined),
  ];
  channel.onclose = () => { if (words === channel) { words = null; offWords.forEach((off) => off()); offWords = []; } };
}

/** The phone's audio, for micCapture. Null until the call is up. */
export function phoneMicStream(): MediaStream | null {
  return stream && stream.getAudioTracks().some((t) => t.readyState === 'live') ? stream : null;
}

function closePeer(): void {
  if (meter) { window.clearInterval(meter.timer); void meter.ctx.close().catch(() => undefined); meter = null; }
  if (sink) { sink.srcObject = null; sink.remove(); sink = null; }
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  queued = [];
  offWords.forEach((off) => off());
  offWords = [];
  words = null;
  if (pc) { pc.onicecandidate = null; pc.ontrack = null; pc.ondatachannel = null; pc.onconnectionstatechange = null; pc.close(); pc = null; }
  usePhoneMicStore.setState({ level: 0 });
}

function startMeter(s: MediaStream): void {
  try {
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(s).connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    const timer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const db = 20 * Math.log10(Math.sqrt(sum / data.length) || 1e-6);
      // -60 dB → 0, 0 dB → 100.
      usePhoneMicStore.setState({ level: Math.round(Math.max(0, Math.min(100, (db + 60) / 60 * 100))) });
    }, 100);
    meter = { ctx, timer };
  } catch {
    /* no meter is not no microphone */
  }
}

async function answer(offer: Extract<PhoneMicMessage, { kind: 'offer' }>): Promise<void> {
  const api = window.api!;
  closePeer();
  const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  pc = peer;
  peer.onicecandidate = (e) => {
    if (e.candidate) api.phoneMicSignal({ kind: 'ice', from: 'desktop', candidate: e.candidate.toJSON() as { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null } });
  };
  peer.ontrack = (e) => {
    stream = e.streams[0] ?? new MediaStream([e.track]);
    sink = document.createElement('audio');
    sink.muted = true;
    sink.srcObject = stream;
    sink.setAttribute('aria-hidden', 'true');
    sink.style.display = 'none';
    document.body.append(sink);
    void sink.play().catch(() => undefined);
    startMeter(stream);
  };
  peer.ondatachannel = (e) => { if (pc === peer && e.channel.label === 'words') watchWords(e.channel); };
  peer.onconnectionstatechange = () => {
    if (pc !== peer) return;
    if (peer.connectionState === 'connected') api.phoneMicPeerState('connected');
    else if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
      api.phoneMicPeerState('failed', 'the call to the phone dropped — is it still on the church Wi-Fi?');
      closePeer();
    }
  };
  try {
    await peer.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
    for (const c of queued) await peer.addIceCandidate(c).catch(() => undefined);
    queued = [];
    const local = await peer.createAnswer();
    await peer.setLocalDescription(local);
    api.phoneMicSignal({ kind: 'answer', sdp: local.sdp ?? '' });
  } catch (e) {
    api.phoneMicPeerState('failed', e instanceof Error ? e.message : 'could not answer the phone');
    closePeer();
  }
}

/** Wire the call to main's signalling. Call once; returns the unsubscribe. */
export function installPhoneMic(): () => void {
  const api = window.api;
  if (!api?.onPhoneMicSignal) return () => undefined;
  void api.phoneMicStatus?.().then((status) => usePhoneMicStore.setState({ status })).catch(() => undefined);
  const offSignal = api.onPhoneMicSignal((m) => {
    if (m.kind === 'offer') void answer(m);
    else if (m.kind === 'ice' && m.from === 'phone') {
      if (pc?.remoteDescription) void pc.addIceCandidate(m.candidate).catch(() => undefined);
      else queued.push(m.candidate);
    } else if (m.kind === 'bye') closePeer();
  });
  const offStatus = api.onPhoneMicStatus((status) => {
    usePhoneMicStore.setState({ status });
    if (status.state === 'idle' || status.state === 'ended' || status.state === 'expired' || status.state === 'error') closePeer();
  });
  return () => { offSignal(); offStatus(); closePeer(); };
}
