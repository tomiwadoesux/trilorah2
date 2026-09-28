export const DEVICE_AUDIO = 'Device audio (computer sound)'
export const DEVICE_AND_MIC = 'Device audio + default microphone'

export function usesDeviceAudio(label?: string): boolean {
  return label === DEVICE_AUDIO || label === DEVICE_AND_MIC
}
