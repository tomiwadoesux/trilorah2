/**
 * In-app microphone capture — replaces the engine's SoX dependency.
 *
 * When the main process has no `rec` binary it broadcasts `on-mic-request`;
 * this module answers with getUserMedia, downsamples to 16-bit mono PCM at
 * the requested sample rate, and streams chunks (plus an RMS level for the
 * meter) back over IPC.
 */

let ctx: AudioContext | null = null;
let stream: MediaStream | null = null;
let processor: ScriptProcessorNode | null = null;

async function resolveDeviceId(deviceLabel?: string): Promise<string | undefined> {
  if (!deviceLabel || deviceLabel === 'default') return undefined;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const wanted = deviceLabel.toLowerCase();
    const match = devices.find(
      (d) => d.kind === 'audioinput' && d.label.toLowerCase().includes(wanted),
    );
    return match?.deviceId;
  } catch {
    return undefined;
  }
}

export async function startMicCapture(sampleRate: number, deviceLabel?: string): Promise<void> {
  stopMicCapture();

  const permission = await window.api?.requestMicPermission?.();
  if (permission && !permission.granted) {
    throw new Error('microphone permission denied — allow it in System Settings → Privacy');
  }

  const deviceId = await resolveDeviceId(deviceLabel);
  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
      channelCount: 1,
    },
  });

  ctx = new AudioContext({ sampleRate });
  const source = ctx.createMediaStreamSource(stream);
  processor = ctx.createScriptProcessor(4096, 1, 1);

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
  source.connect(processor);
  processor.connect(mute);
  mute.connect(ctx.destination);
}

export function stopMicCapture(): void {
  processor?.disconnect();
  processor = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  void ctx?.close().catch(() => undefined);
  ctx = null;
}
