import { describe, expect, it } from 'vitest'
import { isNetworkSound, networkSoundComputer, networkSoundLabel, networkSoundSource, networkSoundTitle, tidyAudioInputs, usesWindowCapture } from './audioInput'

describe('network sound labels', () => {
  it('round-trips an NDI source name', () => {
    const label = networkSoundLabel('VMIX-PC (Trilorah Sound)')
    expect(isNetworkSound(label)).toBe(true)
    expect(networkSoundSource(label)).toBe('VMIX-PC (Trilorah Sound)')
  })

  it('is never mistaken for a device the window or SoX opens', () => {
    expect(isNetworkSound('Scarlett 2i2 USB')).toBe(false)
    expect(isNetworkSound(undefined)).toBe(false)
    expect(usesWindowCapture(networkSoundLabel('VMIX-PC (Trilorah Sound)'))).toBe(false)
  })

  it('names the computer, without a Mac’s .local', () => {
    expect(networkSoundComputer('VMIX-PC (Trilorah Sound)')).toBe('VMIX-PC')
    expect(networkSoundComputer('AYOS-MACBOOK-AIR.LOCAL (Trilorah Sound)')).toBe('AYOS-MACBOOK-AIR')
    expect(networkSoundComputer('NO BRACKETS')).toBe('NO BRACKETS')
  })

  it('says "sound from" for a Trilorah sender and the full name for anything else', () => {
    expect(networkSoundTitle(networkSoundLabel('VMIX-PC (Trilorah Sound)'))).toBe('sound from VMIX-PC')
    expect(networkSoundTitle(networkSoundLabel('VMIX-PC (Output 1)'))).toBe('network · VMIX-PC (Output 1)')
  })
})

describe('tidyAudioInputs — the picker a volunteer can actually read', () => {
  const labels = (list: { label: string }[]) => list.map((d) => d.label)

  it('puts microphones, line-ins and USB interfaces before oddballs, virtual cables last', () => {
    const tidy = tidyAudioInputs([
      { label: 'Stereo Mix (Realtek(R) Audio)' },
      { label: 'CABLE Output (VB-Audio Virtual Cable)' },
      { label: 'Mystery Endpoint' },
      { label: 'Microphone (Scarlett 2i2 USB)' },
      { label: 'Line In (Realtek(R) Audio)' },
      { label: 'VoiceMeeter Output (VB-Audio VoiceMeeter VAIO)' },
    ])
    expect(labels(tidy)).toEqual([
      'Microphone (Scarlett 2i2 USB)',
      'Line In (Realtek(R) Audio)',
      'Mystery Endpoint',
      'Stereo Mix (Realtek(R) Audio)',
      'CABLE Output (VB-Audio Virtual Cable)',
      'VoiceMeeter Output (VB-Audio VoiceMeeter VAIO)',
    ])
  })

  it('keeps the first of a doubled label and keeps order among equals', () => {
    const tidy = tidyAudioInputs([
      { label: 'Microphone (USB Audio Device)', id: 'a' },
      { label: 'Microphone (USB Audio Device)', id: 'b' },
      { label: 'Microphone Array (Realtek(R) Audio)', id: 'c' },
    ] as { label: string; id: string }[])
    expect(tidy.map((d) => (d as { id: string }).id)).toEqual(['a', 'c'])
  })

  it('drops a Hands-Free twin only when the device is also listed as itself', () => {
    const twinned = tidyAudioInputs([
      { label: 'Microphone (Jabra Evolve2 65)' },
      { label: 'Headset (Jabra Evolve2 65 Hands-Free AG Audio)' },
    ])
    expect(labels(twinned)).toEqual(['Microphone (Jabra Evolve2 65)'])
    // A Bluetooth headset whose only input IS the hands-free endpoint stays.
    const only = tidyAudioInputs([{ label: 'Headset (WH-1000XM4 Hands-Free AG Audio)' }])
    expect(labels(only)).toEqual(['Headset (WH-1000XM4 Hands-Free AG Audio)'])
  })

  it('ranks an NDI virtual device low without touching network-sound labels elsewhere', () => {
    const tidy = tidyAudioInputs([
      { label: 'NDI Audio (NewTek NDI Audio)' },
      { label: 'Microphone (Blue Yeti)' },
    ])
    expect(labels(tidy)).toEqual(['Microphone (Blue Yeti)', 'NDI Audio (NewTek NDI Audio)'])
  })
})
