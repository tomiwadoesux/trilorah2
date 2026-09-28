/**
 * In-app microphone capture — replaces the engine's SoX dependency.
 *
 * When the main process has no `rec` binary it broadcasts `on-mic-request`;
 * this module answers with getUserMedia, downsamples to 16-bit mono PCM at
 * the requested sample rate, and streams chunks (plus an RMS level for the
 * meter) back over IPC.
 */

import { DEVICE_AND_MIC, usesDeviceAudio } from '../../shared/audioInput';

let ctx: AudioContext | null = null;
let streams: MediaStream[] = [];
let processor: ScriptProcessorNode | null = null;
let generation = 0;

async function resolveDeviceId(deviceLabel?: string): Promise<string | undefined> {
  if (!deviceLabel || deviceLabel === 'default') return undefined;
  try {
    const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
      (d) => d.kind === 'audioinput',
    );
    const wanted = deviceLabel.toLowerCase();
    // Exact label first — substring only as a fallback, so "USB Audio" can't
    // hijack "USB Audio CODEC" when both are plugged in.
    const match =
      inputs.find((d) => d.label.toLowerCase() === wanted) ??
      inputs.find((d) => d.label.toLowerCase().includes(wanted)) ??
      inputs.find((d) => wanted.includes(d.label.toLowerCase()) && d.label.length > 3);
    if (!match) {
      console.warn(`mic "${deviceLabel}" not found — falling back to the system default input`);
    }
    return match?.deviceId;
  } catch (err) {
    console.error('mic: could not enumerate devices to resolve the saved one', err);
    return undefined;
  }
}

async function openMicrophone(deviceLabel?: string): Promise<MediaStream> {
  const permission = await window.api?.requestMicPermission?.();
  if (permission && !permission.granted) {
    throw new Error('microphone permission denied — allow it in System Settings → Privacy');
  }

  const deviceId = await resolveDeviceId(deviceLabel);
  const constraints = (id?: string): MediaStreamConstraints => ({
    audio: {
      ...(id ? { deviceId: { exact: id } } : {}),
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
      channelCount: 1,
    },
  });
  try {
    return await navigator.mediaDevices.getUserMedia(constraints(deviceId));
  } catch (e) {
    if (deviceId) {
      // Chosen device unplugged or busy — fall back to the default input
      // rather than leaving the service with no ears at all.
      console.warn('selected mic failed, retrying with the default input:', e);
      return await navigator.mediaDevices.getUserMedia(constraints(undefined));
    } else if (e instanceof DOMException && (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError')) {
      throw new Error('no microphone found — plug in the soundboard/USB input and check the computer\'s sound settings');
    } else if (e instanceof DOMException && e.name === 'NotAllowedError') {
      throw new Error('microphone access blocked — allow it in the system privacy settings, then press Start Listening again');
    } else {
      throw e;
    }
  }
}

export async function startMicCapture(sampleRate: number, deviceLabel?: string): Promise<void> {
  stopMicCapture();
  const ticket = generation;
  const acquired: MediaStream[] = [];
  const release = () => acquired.forEach((s) => s.getTracks().forEach((t) => t.stop()));
  try {
    if (usesDeviceAudio(deviceLabel)) {
      const supported = await window.api?.getAudioCaptureCapabilities?.();
      if (!supported?.deviceAudio) throw new Error('Device audio capture is available on Windows. Choose a microphone on this device.');
      if (ticket !== generation) return;
      const desktop = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      acquired.push(desktop);
      if (!desktop.getAudioTracks().length) throw new Error('No device audio stream was available. Check the computer sound output and try again.');
      if (ticket !== generation) { release(); return; }
      if (deviceLabel === DEVICE_AND_MIC) acquired.push(await openMicrophone());
    } else {
      acquired.push(await openMicrophone(deviceLabel));
    }
    // Stop may arrive while a permission prompt or stream request is pending.
    if (ticket !== generation) { release(); return; }
    streams = acquired;
    ctx = new AudioContext({ sampleRate });
    processor = ctx.createScriptProcessor(4096, 1, 1);
    for (const captured of streams) {
      ctx.createMediaStreamSource(captured).connect(processor);
      captured.getAudioTracks().forEach((track) => track.addEventListener('ended', () => {
        if (ticket !== generation) return;
        stopMicCapture();
        window.api?.stopListening();
      }));
    }
    await ctx.resume();
    if (ticket !== generation) return;
  } catch (error) {
    release();
    if (ticket !== generation) return;
    stopMicCapture();
    throw error;
  }
  if (!ctx || !processor) return;

  let lastLevelAt = 0;
  processor.onaudioprocess = (e) => {
    const f32 = e.inputBuffer.getChannelData(0);
    const i16 = new Int16Array(f32.length);
    let sumSquares = 0;
    for (let i = 0; i < f32.length; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      sumSquares += s * s;
    }
    window.api?.sendAudioChunk?.(i16.buffer);

    const now = performance.now();
    if (now - lastLevelAt > 200) {
      lastLevelAt = now;
      const rms = Math.sqrt(sumSquares / f32.length);
      const db = rms > 0 ? Math.max(-60, 20 * Math.log10(rms)) : -60;
      window.api?.sendAudioLevel?.(Math.round(db));
    }
  };

  // ScriptProcessor only runs when connected; route through a muted gain so
  // the congregation never hears the mic echoed back.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  processor.connect(mute);
  mute.connect(ctx.destination);
}

export function stopMicCapture(): void {
  generation++;
  if (processor) processor.onaudioprocess = null;
  processor?.disconnect();
  processor = null;
  streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
  streams = [];
  void ctx?.close().catch(() => undefined);
  ctx = null;
}
