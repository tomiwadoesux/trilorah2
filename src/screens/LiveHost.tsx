import { useEffect, useRef, useState } from 'react';
import { LiveScreen } from '../design/screens/Live';
import { ArtboardProvider, type ArtboardSize } from '../design/screens/artboard';
import { tierForWidth } from '../ui/density';

/*
 * The Trilorah LIVE screen, running as the app.
 *
 * In the sandbox the screen is drawn on an artboard — a fixed size picked
 * from a toolbar. Here the artboard IS the window: this measures the region
 * the app gives the LIVE tab and hands that to the screen through the same
 * context, so the screen cannot tell the difference and nothing in it had to
 * change to ship.
 *
 * `full` because the app owns the whole region — no rounded window corner,
 * no drop shadow; those exist to say "this is a window on a canvas".
 */
export function LiveHost() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ArtboardSize | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      if (!w || !h) return;
      setSize((prev) =>
        prev && prev.w === w && prev.h === h
          ? prev
          : { id: 'window', label: 'window', w, h, tier: tierForWidth(w), note: 'the app window', full: true },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-full w-full overflow-hidden">
      {size && (
        <ArtboardProvider value={size}>
          <LiveScreen />
        </ArtboardProvider>
      )}
    </div>
  );
}
