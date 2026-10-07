export const DEVICE_AUDIO = 'Device audio (computer sound)'
export const DEVICE_AND_MIC = 'Device audio + default microphone'

export function usesDeviceAudio(label?: string): boolean {
  return label === DEVICE_AUDIO || label === DEVICE_AND_MIC
}

/**
 * Inputs the engine must take from the app window (getUserMedia / WebRTC)
 * rather than from SoX: computer sound, and the phone over Wi-Fi. SoX can
 * only open a device the OS knows about.
 */
export const PHONE_MIC_LABEL = 'Phone microphone (over Wi-Fi)'
export function usesWindowCapture(label?: string): boolean {
  return usesDeviceAudio(label) || label === PHONE_MIC_LABEL
}
