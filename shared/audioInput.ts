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

/*
 * Sound another computer sends over the network with NDI® — Trilorah's sender
 * mode on the computer the soundboard is plugged into. The label is the
 * prefix plus the NDI source name, which NDI makes "COMPUTER (Source)".
 * Main receives it itself (electron/ndi/networkSound.ts), so it never goes
 * to SoX or the app window.
 */
export const NETWORK_SOUND_PREFIX = 'Network sound: '
/** What sender mode calls itself on the network; NDI puts the computer's name in front. */
export const SENDER_SOURCE_NAME = 'Trilorah Sound'

export function networkSoundLabel(source: string): string {
  return `${NETWORK_SOUND_PREFIX}${source}`
}
export function isNetworkSound(label?: string): boolean {
  return !!label && label.startsWith(NETWORK_SOUND_PREFIX)
}
export function networkSoundSource(label: string): string {
  return label.slice(NETWORK_SOUND_PREFIX.length)
}
/** "VMIX-PC (Trilorah Sound)" → "VMIX-PC". A Mac's ".LOCAL" goes too; anything without the brackets is left as it is. */
export function networkSoundComputer(source: string): string {
  const at = source.lastIndexOf(' (')
  const computer = at > 0 && source.endsWith(')') ? source.slice(0, at) : source
  return computer.replace(/\.local$/i, '')
}
/** How a network input reads in a picker: "sound from VMIX-PC" for a Trilorah sender, the full NDI name for anything else. */
export function networkSoundTitle(label: string): string {
  const source = networkSoundSource(label)
  return source.endsWith(`(${SENDER_SOURCE_NAME})`) ? `sound from ${networkSoundComputer(source)}` : `network · ${source}`
}

/** Which side of a stereo input the sender passes on. A mic on input 1 of a two-input box arrives on the left only. */
export type SenderChannels = 'both' | 'left' | 'right'
