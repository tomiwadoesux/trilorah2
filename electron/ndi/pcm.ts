/**
 * Sound arithmetic for the network link (electron/ndi/networkSound.ts).
 *
 * NDI carries float samples one channel after another ("planar"). The speech
 * engines want 16-bit mono at their own rate — 48 kHz for Deepgram, 16 kHz
 * for local Whisper — the same bytes the app window's microphone sends
 * (src/lib/micCapture.ts). Pure functions, so they are tested without NDI.
 */

/** Average a planar float frame's channels into one. `strideBytes` is the distance between channels. */
export function planarToMono(data: Uint8Array, channels: number, samples: number, strideBytes: number): Float32Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const out = new Float32Array(samples)
  if (channels < 1 || samples < 1) return out
  for (let c = 0; c < channels; c++) {
    const base = c * strideBytes
    for (let i = 0; i < samples; i++) out[i] += view.getFloat32(base + i * 4, true)
  }
  if (channels > 1) for (let i = 0; i < samples; i++) out[i] /= channels
  return out
}

/** A windowed-sinc low-pass: `cutoff` in cycles per sample (0–0.5), Hamming window, gain 1. */
function lowPass(cutoff: number, length: number): Float32Array {
  const taps = new Float32Array(length)
  const mid = (length - 1) / 2
  let sum = 0
  for (let i = 0; i < length; i++) {
    const x = i - mid
    const sinc = x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x)
    const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (length - 1))
    taps[i] = sinc * window
    sum += taps[i]
  }
  for (let i = 0; i < length; i++) taps[i] /= sum
  return taps
}

/** Taps for the anti-alias filter: 63 at 48 kHz is a ~2.5 kHz transition and about −50 dB beyond it. */
const TAPS = 63

/**
 * Changes sample rate a frame at a time, carrying its place across frames so
 * the joins don't click. Going down, a low-pass filter runs first — 48 kHz to
 * 16 kHz without one folds the hiss above 8 kHz back into the voice band the
 * speech engine reads. Linear between neighbours after that; plenty for speech.
 */
export class Resampler {
  private readonly step: number
  /** Position of the next output sample, in input samples from the start of `tail`. */
  private pos = 0
  /** The last input sample of the previous frame, so interpolation can reach back across the join. */
  private tail = 0
  private primed = false
  private readonly taps: Float32Array | null
  /** The filter's memory: the last TAPS − 1 input samples of the previous frame. */
  private history: Float32Array

  constructor(readonly fromRate: number, readonly toRate: number) {
    this.step = fromRate / toRate
    this.taps = fromRate > toRate ? lowPass((0.45 * toRate) / fromRate, TAPS) : null
    this.history = new Float32Array(TAPS - 1)
  }

  private filter(input: Float32Array): Float32Array {
    const taps = this.taps
    if (!taps) return input
    const n = taps.length
    const joined = new Float32Array(n - 1 + input.length)
    joined.set(this.history, 0)
    joined.set(input, n - 1)
    const out = new Float32Array(input.length)
    for (let i = 0; i < input.length; i++) {
      let acc = 0
      for (let k = 0; k < n; k++) acc += taps[k] * joined[i + k]
      out[i] = acc
    }
    this.history = joined.slice(joined.length - (n - 1))
    return out
  }

  process(raw: Float32Array): Float32Array {
    if (this.fromRate === this.toRate) return raw
    const input = this.filter(raw)
    // Index 0 is the previous frame's last sample; input starts at index 1.
    const at = (i: number) => (i <= 0 ? this.tail : input[Math.min(i - 1, input.length - 1)])
    if (!this.primed) {
      this.primed = true
      this.tail = input[0] ?? 0
      this.pos = 1
    }
    const out: number[] = []
    while (this.pos <= input.length) {
      const i = Math.floor(this.pos)
      const frac = this.pos - i
      out.push(at(i) + (at(i + 1) - at(i)) * frac)
      this.pos += this.step
    }
    this.pos -= input.length
    this.tail = input[input.length - 1] ?? this.tail
    return Float32Array.from(out)
  }
}

/** Float −1…1 to 16-bit little-endian, clipped the way micCapture clips. */
export function floatToInt16(samples: Float32Array): Buffer {
  const out = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    out.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), i * 2)
  }
  return out
}

/** The meter's number: RMS in dB, floored at −60 like the app window's microphone. */
export function levelDb(samples: Float32Array): number {
  if (!samples.length) return -60
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  const rms = Math.sqrt(sum / samples.length)
  return rms > 0 ? Math.max(-60, Math.round(20 * Math.log10(rms))) : -60
}
