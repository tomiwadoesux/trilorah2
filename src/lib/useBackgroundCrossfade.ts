import { useEffect, useRef, useState } from 'react'

/*
 * The wall's background, changed without a dark frame.
 *
 * The output paints its background as a CSS background-image, and swapping
 * that property drops the old picture the instant the new one is asked for —
 * before a byte of it has been read. For a large photo that is a beat of
 * black behind the words, mid-service, every time somebody drops a new
 * background on the LIVE box.
 *
 * So the old picture stays painted while the new one is fetched and decoded
 * off to one side, and only then does the new layer go on top and fade in
 * over it. Once it is fully in, the old layer is dropped. Reduced motion gets
 * the same wait and a cut instead of the fade.
 *
 * The first picture after nothing simply appears: there is nothing under it
 * to cross from.
 */

export const BACKGROUND_FADE_MS = 300

export interface BackgroundLayer {
  url: string
  /** Stable per layer, so React keeps the old element while the new fades in. */
  key: number
  /** True while it is fading in over the one under it. */
  entering: boolean
}

export function useBackgroundCrossfade(url: string): BackgroundLayer[] {
  const [layers, setLayers] = useState<BackgroundLayer[]>([])
  const seq = useRef(0)

  useEffect(() => {
    if (!url) {
      setLayers([])
      return
    }
    let gone = false
    const show = () => {
      if (gone) return
      const cut = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
      setLayers((prev) => {
        const top = prev[prev.length - 1]
        if (top?.url === url) return prev
        const next = { url, key: (seq.current += 1), entering: !cut && !!top }
        return cut || !top ? [next] : [{ ...top, entering: false }, next]
      })
    }
    /* A picture that will not decode still replaces the old one — the CSS
       paints whatever it can of it, which is what happened before this. */
    const img = new Image()
    img.src = url
    img.decode().then(show, show)
    return () => {
      gone = true
    }
  }, [url])

  const top = layers[layers.length - 1]
  useEffect(() => {
    if (!top?.entering) return
    const key = top.key
    const t = window.setTimeout(() => {
      setLayers((prev) => {
        const last = prev[prev.length - 1]
        return last?.key === key ? [{ ...last, entering: false }] : prev
      })
    }, BACKGROUND_FADE_MS + 50)
    return () => window.clearTimeout(t)
  }, [top?.key, top?.entering])

  return layers
}
