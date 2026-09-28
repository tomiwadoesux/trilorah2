import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMicCapture, stopMicCapture } from './micCapture';
import { DEVICE_AUDIO, DEVICE_AND_MIC } from '../../shared/audioInput';

function stream(audio = true) {
  const audioTrack = { stop: vi.fn(), addEventListener: vi.fn() };
  const videoTrack = { stop: vi.fn(), addEventListener: vi.fn() };
  return {
    getAudioTracks: () => audio ? [audioTrack] : [],
    getTracks: () => audio ? [audioTrack, videoTrack] : [videoTrack],
  } as unknown as MediaStream;
}

const display = vi.fn();
const microphone = vi.fn();
const source = vi.fn((_stream: MediaStream) => ({ connect: vi.fn() }));
const close = vi.fn(async () => undefined);
const micPermission = vi.fn(async () => ({ granted: true }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', { api: { getAudioCaptureCapabilities: async () => ({ deviceAudio: true }), requestMicPermission: micPermission } });
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: display, getUserMedia: microphone, enumerateDevices: async () => [] } });
  vi.stubGlobal('AudioContext', class {
    destination = {};
    createMediaStreamSource = source;
    createScriptProcessor = () => ({ connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null });
    createGain = () => ({ gain: { value: 1 }, connect: vi.fn() });
    resume = async () => undefined;
    close = close;
  });
});

afterEach(() => { stopMicCapture(); vi.unstubAllGlobals(); });

describe('audio capture lifecycle', () => {
  it('captures computer sound without requesting the microphone and stops every track', async () => {
    const desktop = stream();
    display.mockResolvedValue(desktop);
    await startMicCapture(16000, DEVICE_AUDIO);
    expect(microphone).not.toHaveBeenCalled();
    expect(micPermission).not.toHaveBeenCalled();
    expect(source).toHaveBeenCalledWith(desktop);
    stopMicCapture();
    desktop.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalled());
  });

  it('mixes device audio and the default microphone into the PCM processor', async () => {
    const desktop = stream();
    const mic = stream();
    display.mockResolvedValue(desktop);
    microphone.mockResolvedValue(mic);
    await startMicCapture(16000, DEVICE_AND_MIC);
    expect(source.mock.calls.map((args) => args[0])).toEqual([desktop, mic]);
    stopMicCapture();
    [...desktop.getTracks(), ...mic.getTracks()].forEach((track) => expect(track.stop).toHaveBeenCalled());
  });

  it('releases device capture if opening the microphone fails', async () => {
    const desktop = stream();
    display.mockResolvedValue(desktop);
    microphone.mockRejectedValue(new Error('microphone unavailable'));
    await expect(startMicCapture(16000, DEVICE_AND_MIC)).rejects.toThrow('microphone unavailable');
    desktop.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalled());
  });

  it('does not resurrect capture when Stop is pressed during a pending request', async () => {
    const desktop = stream();
    let resolve!: (value: MediaStream) => void;
    display.mockImplementation(() => new Promise<MediaStream>((r) => { resolve = r; }));
    const starting = startMicCapture(16000, DEVICE_AUDIO);
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
    stopMicCapture();
    resolve(desktop);
    await starting;
    expect(source).not.toHaveBeenCalled();
    desktop.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalled());
  });

  it('reports missing system audio instead of silently switching to the microphone', async () => {
    const desktop = stream(false);
    display.mockResolvedValue(desktop);
    await expect(startMicCapture(16000, DEVICE_AUDIO)).rejects.toThrow('No device audio');
    expect(microphone).not.toHaveBeenCalled();
    desktop.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalled());
  });
});
