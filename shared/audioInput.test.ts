import { describe, expect, it } from 'vitest'
import { isNetworkSound, networkSoundComputer, networkSoundLabel, networkSoundSource, networkSoundTitle, usesWindowCapture } from './audioInput'

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
