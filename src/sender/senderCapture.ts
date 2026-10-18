/**
 * Sender mode's ears: the chosen input, untouched, sent to main in 20 ms
 * pieces for NDI® (electron/ndi/networkSound.ts).
 *
 * Not src/lib/micCapture.ts. That one is built for speech recognition —
 * mono, 16-bit, the computer's automatic volume switched on, and it stops
 * whenever listening stops. This one is what a sound desk would send: 48 kHz
 * stereo floats with every phone-call clean-up off, running until the window
 * closes. The other Trilorah does its own conversion for its speech engine.
 */

import { usesDeviceAudio, type SenderChannels } from '../../shared/audioInput';

/** 20 ms at 48 kHz. NDI likes sound in pieces of about half a video frame. */
const FRAME = 960;

/* An AudioWorklet runs off the page's main thread, so a busy window never
   drops sound. Inline as a blob so it loads the same from the dev server
   and from the packaged app's file:// pages. */
const TAP = `
class TrilorahTap extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.size = options.processorOptions.size;
    this.fill = 0;
    this.left = new Float32Array(this.size);
    this.right = new Float32Array(this.size);
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input.length) return true;
    const l = input[0];
    const r = input[1] || input[0];
    for (let i = 0; i < l.length; i++) {
      this.left[this.fill] = l[i];
      this.right[this.fill] = r[i];
      if (++this.fill === this.size) {
        this.port.postMessage({ left: this.left, right: this.right }, [this.left.buffer, this.right.buffer]);
        this.left = new Float32Array(this.size);
        this.right = new Float32Array(this.size);
        this.fill = 0;
      }
    }
    return true;
  }
}
registerProcessor('trilorah-tap', TrilorahTap);
`;

export interface SenderCapture {
  /** The rate the sound actually runs at — 48 kHz unless the browser refused it. */
  sampleRate: number;
  setChannels(channels: SenderChannels): void;
  stop(): void;
}

export interface SenderCaptureOptions {
  deviceLabel: string;
  channels: SenderChannels;
  /** Left and right RMS in dB, about ten times a second. */
  onLevel(left: number, right: number): void;
  /** The input went away — unplugged, or the computer took it back. */
  onEnded(): void;
}

async function deviceIdFor(label: string): Promise<string | undefined> {
  if (!label) return undefined;
  const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  const wanted = label.toLowerCase();
  const match = inputs.find((d) => d.label.toLowerCase() === wanted) ?? inputs.find((d) => d.label.toLowerCase().includes(wanted));
  if (!match) throw new Error(`${label} is not connected to this computer`);
  return match.deviceId;
}

async function openInput(label: string): Promise<MediaStream> {
  if (usesDeviceAudio(label)) {
    // Windows only (main answers getDisplayMedia with loopback). Chromium
    // insists on a picture as well; it is captured and never used, as in
    // the operator window's own computer-sound capture.
    const desktop = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    if (!desktop.getAudioTracks().length) {
      desktop.getTracks().forEach((t) => t.stop());
      throw new Error('This computer did not hand over its sound');
    }
    return desktop;
  }
  const permission = await window.api?.requestMicPermission?.();
  if (permission && !permission.granted) throw new Error('Microphone access is blocked. Allow it in the system privacy settings');
  const deviceId = await deviceIdFor(label);
  return navigator.mediaDevices.getUserMedia({
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      // A sound desk's feed is already mixed. Phone-call clean-up would pump
      // the level and smear the voice the other computer has to read.
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      // Ideal, not exact: with clean-up off the input keeps its own rate, and
      // an exact 48 kHz fails outright on an interface set to 44.1.
      channelCount: { ideal: 2 },
      sampleRate: { ideal: 48000 },
    },
  });
}

function db(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / samples.length);
  return rms > 0 ? Math.max(-60, 20 * Math.log10(rms)) : -60;
}

export async function startSenderCapture(options: SenderCaptureOptions): Promise<SenderCapture> {
  const stream = await openInput(options.deviceLabel);
  let channels = options.channels;
  let ctx: AudioContext | null = null;
  let url = '';
  try {
    /* No speaker: the context runs on its own clock instead of the default
       output's, which on a church computer is often the projector's HDMI —
       and it can never play the desk back into the room. */
    ctx = new AudioContext({ sampleRate: 48000, sinkId: { type: 'none' } } as AudioContextOptions);
    url = URL.createObjectURL(new Blob([TAP], { type: 'text/javascript' }));
    await ctx.audioWorklet.addModule(url);
    const source = ctx.createMediaStreamSource(stream);
    const tap = new AudioWorkletNode(ctx, 'trilorah-tap', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      // A one-channel input is spread to both sides before it gets here.
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
      processorOptions: { size: FRAME },
    });
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(tap);
    tap.connect(mute);
    mute.connect(ctx.destination);

    const rate = ctx.sampleRate;
    let lastLevelAt = 0;
    tap.port.onmessage = (event: MessageEvent<{ left: Float32Array; right: Float32Array }>) => {
      const { left, right } = event.data;
      const l = channels === 'right' ? right : left;
      const r = channels === 'left' ? left : right;
      const planar = new Float32Array(FRAME * 2);
      planar.set(l, 0);
      planar.set(r, FRAME);
      window.api?.sendNetworkSoundFrame?.({ sampleRate: rate, channels: 2, samples: FRAME, data: planar.buffer });
      const now = performance.now();
      if (now - lastLevelAt > 100) {
        lastLevelAt = now;
        options.onLevel(db(l), db(r));
      }
    };
    stream.getAudioTracks().forEach((track) => track.addEventListener('ended', () => options.onEnded()));
    await ctx.resume();
  } catch (error) {
    stream.getTracks().forEach((t) => t.stop());
    void ctx?.close().catch(() => undefined);
    if (url) URL.revokeObjectURL(url);
    throw error;
  }

  const running = ctx;
  return {
    sampleRate: running.sampleRate,
    setChannels(next) { channels = next; },
    stop() {
      stream.getTracks().forEach((t) => t.stop());
      void running.close().catch(() => undefined);
      URL.revokeObjectURL(url);
    },
  };
}
