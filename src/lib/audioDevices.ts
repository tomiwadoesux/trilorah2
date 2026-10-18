/**
 * Audio input enumeration shared by the Live bar and Settings.
 *
 * Chromium hides device labels until the page has held mic permission once —
 * on a fresh church install the picker looked permanently empty. So when
 * labels are missing we ask for permission, open (and immediately close) a
 * throwaway stream to unlock the labels, and enumerate again.
 */

import { DEVICE_AUDIO, DEVICE_AND_MIC, networkSoundLabel } from '../../shared/audioInput';

export interface AudioInput {
  id: string;
  label: string;
}

/**
 * Every input this computer can listen through. `network` adds the sound
 * other computers send over NDI® (sender mode) after the local devices. Off
 * by default: looking starts NDI and, on a Mac, the local-network permission
 * prompt, so only a picker someone has opened asks for it.
 */
export async function listAudioInputs({ network = false }: { network?: boolean } = {}): Promise<AudioInput[]> {
  const local = await listLocalInputs();
  if (!network) return local;
  const sources = await window.api?.listNetworkSounds?.().catch(() => [] as string[]) ?? [];
  return [...local, ...sources.map((source) => ({ id: `network:${source}`, label: networkSoundLabel(source) }))];
}

async function listLocalInputs(): Promise<AudioInput[]> {
  const capabilities = await window.api?.getAudioCaptureCapabilities?.().catch(() => undefined);
  const deviceInputs = capabilities?.deviceAudio ? [
    { id: 'device-audio', label: DEVICE_AUDIO },
    { id: 'device-and-mic', label: DEVICE_AND_MIC },
  ] : [];
  const md = navigator.mediaDevices;
  if (!md?.enumerateDevices) return deviceInputs;
  let inputs: MediaDeviceInfo[] = [];
  try {
    inputs = (await md.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  } catch (err) {
    console.error('mic: enumerateDevices failed', err);
    return deviceInputs;
  }
  const labelsLocked = inputs.length === 0 || inputs.every((d) => !d.label);
  if (labelsLocked) {
    try {
      await window.api?.requestMicPermission?.();
      const stream = await md.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      inputs = (await md.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    } catch (err) {
      // Permission denied or genuinely no input hardware. This used to be a
      // bare catch, and it is how a dead microphone looked healthy for a whole
      // service: the picker kept listing devices from before the denial while
      // capture could never start. Loud now, because the two failures need
      // very different fixes.
      console.error('mic: could not open a stream to unlock device labels', err);
    }
  }
  /* Chromium lists the system's default input twice: once as itself and once
     as "Default - <its name>" (and "Communications - …" on Windows). The
     copies are the same microphone under a second name; "system default"
     already covers following the OS, so they are never shown. */
  return [...deviceInputs, ...inputs
    .filter((d) => d.label && d.deviceId !== 'default' && d.deviceId !== 'communications')
    .map((d) => ({ id: d.deviceId, label: d.label }))];
}

/** Subscribe to plug/unplug events; returns the unsubscribe. */
export function onDeviceChange(handler: () => void): () => void {
  navigator.mediaDevices?.addEventListener?.('devicechange', handler);
  return () => navigator.mediaDevices?.removeEventListener?.('devicechange', handler);
}
