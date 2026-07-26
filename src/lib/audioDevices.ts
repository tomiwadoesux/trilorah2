/**
 * Audio input enumeration shared by the Live bar and Settings.
 *
 * Chromium hides device labels until the page has held mic permission once —
 * on a fresh church install the picker looked permanently empty. So when
 * labels are missing we ask for permission, open (and immediately close) a
 * throwaway stream to unlock the labels, and enumerate again.
 */

export interface AudioInput {
  id: string;
  label: string;
}

export async function listAudioInputs(): Promise<AudioInput[]> {
  const md = navigator.mediaDevices;
  if (!md?.enumerateDevices) return [];
  let inputs: MediaDeviceInfo[] = [];
  try {
    inputs = (await md.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  } catch {
    return [];
  }
  const labelsLocked = inputs.length === 0 || inputs.every((d) => !d.label);
  if (labelsLocked) {
    try {
      await window.api?.requestMicPermission?.();
      const stream = await md.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      inputs = (await md.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    } catch {
      // Permission denied or genuinely no input hardware — return what we have.
    }
  }
  return inputs
    .filter((d) => d.label && d.deviceId !== 'communications')
    .map((d) => ({ id: d.deviceId, label: d.label }));
}

/** Subscribe to plug/unplug events; returns the unsubscribe. */
export function onDeviceChange(handler: () => void): () => void {
  navigator.mediaDevices?.addEventListener?.('devicechange', handler);
  return () => navigator.mediaDevices?.removeEventListener?.('devicechange', handler);
}
