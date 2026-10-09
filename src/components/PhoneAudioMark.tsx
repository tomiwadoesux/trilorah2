import { useEffect, useRef } from 'react';

const MORPH_MS = 480;
const HEIGHTS = [10, 18, 30, 42, 52, 38, 48, 34, 24, 16, 8];
type Curve = [number, number, number, number, number, number, number, number];

function waveCurve(index: number, scale = 1): Curve {
  const x = 79 + index * 6;
  const half = HEIGHTS[index] * scale / 2;
  return [x, 100 - half, x, 100 - half, x, 100 + half, x, 100 + half];
}

/** Equal cubic segments share endpoints and tangents to form smooth Wi-Fi arcs. */
function arc(radius: number, pieces: number): Curve[] {
  return Array.from({ length: pieces }, (_, index) => {
    const start = (-50 + 100 * index / pieces) * Math.PI / 180;
    const end = (-50 + 100 * (index + 1) / pieces) * Math.PI / 180;
    const k = 4 / 3 * Math.tan((end - start) / 4);
    const x1 = 109 + radius * Math.sin(start), y1 = 120 - radius * Math.cos(start);
    const x2 = 109 + radius * Math.sin(end), y2 = 120 - radius * Math.cos(end);
    return [x1, y1, x1 + k * radius * Math.cos(start), y1 + k * radius * Math.sin(start),
      x2 - k * radius * Math.cos(end), y2 - k * radius * Math.sin(end), x2, y2];
  });
}

const outer = arc(38, 4), middle = arc(27, 3), inner = arc(16, 3);
const WIFI_CURVES: Curve[] = [outer[0], outer[1], middle[0], middle[1], inner[0],
  [109, 119.9, 109, 119.9, 109, 120.1, 109, 120.1], inner[1], inner[2], middle[2], outer[2], outer[3]];
const pathData = (c: Curve) => `M${c[0]} ${c[1]}C${c.slice(2).join(' ')}`;
const waveOpacity = (index: number) => index > 1 && index < 9 ? 1 : .5;

/** Decorative hover motion; this symbol does not report an actual connection. */
export function PhoneAudioMark() {
  const root = useRef<SVGGElement>(null);

  useEffect(() => {
    const group = root.current;
    const phone = group?.ownerSVGElement;
    if (!group || !phone) return;
    const paths = [...group.querySelectorAll<SVGPathElement>('.tri-phone-connection-art__bar')];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0;
    let phase: 'wave' | 'morph' | 'wifi' = 'wave';
    let hovered = false;
    let progress = 0;
    let wavePose = HEIGHTS.map((_, index) => waveCurve(index));
    let curves = wavePose;
    let opacities: number[] = HEIGHTS.map((_, index) => waveOpacity(index));
    group.dataset.audioState = phase;
    paths.forEach((path, index) => {
      path.setAttribute('d', pathData(waveCurve(index)));
      path.setAttribute('stroke-opacity', String(waveOpacity(index)));
      path.setAttribute('stroke-width', '2');
    });

    const paint = () => paths.forEach((path, index) => {
      path.setAttribute('d', pathData(curves[index]));
      path.setAttribute('stroke-opacity', String(opacities[index]));
      path.setAttribute('stroke-width', index === 5 ? String(2 + 1.6 * progress) : '2');
    });

    const finish = (toWifi: boolean) => {
      window.cancelAnimationFrame(frame);
      progress = toWifi ? 1 : 0;
      curves = toWifi ? WIFI_CURVES : HEIGHTS.map((_, index) => waveCurve(index));
      opacities = HEIGHTS.map((_, index) => toWifi ? 1 : waveOpacity(index));
      paint();
      // Restoring the base paths and resuming the paused pulse restores its exact pose.
      phase = toWifi ? 'wifi' : 'wave';
      group.dataset.audioState = phase;
    };

    const morph = (toWifi: boolean) => {
      if (toWifi === hovered && phase !== 'morph') return;
      hovered = toWifi;
      window.cancelAnimationFrame(frame);
      if (reduced.matches || document.hidden) { finish(toWifi); return; }
      if (phase === 'wave') {
        // Freeze each bar's current height before its stroke starts bending.
        wavePose = paths.map((path, index) => {
          const transform = getComputedStyle(path).transform;
          const scale = transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).d;
          return waveCurve(index, scale);
        });
        curves = wavePose;
      }
      // A quick pointer reversal starts at the currently drawn shape.
      const from = curves, fromOpacities = opacities;
      const fromProgress = progress;
      const target = toWifi ? WIFI_CURVES : wavePose;
      const duration = Math.max(100, MORPH_MS * Math.abs((toWifi ? 1 : 0) - progress));
      phase = 'morph';
      group.dataset.audioState = phase;
      paint();
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = Math.min(1, (now - start) / duration);
        const eased = elapsed * elapsed * (3 - 2 * elapsed);
        progress = fromProgress + ((toWifi ? 1 : 0) - fromProgress) * eased;
        curves = from.map((curve, index) => curve.map((value, point) => value + (target[index][point] - value) * eased) as Curve);
        opacities = fromOpacities.map((value, index) => value + ((toWifi ? 1 : waveOpacity(index)) - value) * eased);
        paint();
        if (elapsed < 1) frame = window.requestAnimationFrame(tick);
        else finish(toWifi);
      };
      frame = window.requestAnimationFrame(tick);
    };

    const enter = () => { if (hover.matches) morph(true); };
    const leave = () => morph(false);
    const motionChanged = () => { if (reduced.matches && phase === 'morph') finish(hovered); };
    phone.addEventListener('pointerenter', enter);
    phone.addEventListener('pointerleave', leave);
    reduced.addEventListener('change', motionChanged);
    if (phone.matches(':hover')) enter();
    return () => {
      window.cancelAnimationFrame(frame);
      phone.removeEventListener('pointerenter', enter);
      phone.removeEventListener('pointerleave', leave);
      reduced.removeEventListener('change', motionChanged);
    };
  }, []);

  return <g ref={root} className="tri-phone-connection-art__audio" data-audio-state="wave">
    {/* Composite opacity once so joined stroke endpoints stay evenly lit. */}
    <g opacity=".8">
      {HEIGHTS.map((_, index) => <path key={index} className="tri-phone-connection-art__bar"
        d={pathData(waveCurve(index))} fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity={waveOpacity(index)}
        style={{ animationDelay: `${index * -173}ms`, animationDuration: `${1800 + index % 4 * 210}ms` }} />)}
    </g>
    <path d="M91 143h36" strokeOpacity=".3" strokeWidth="1.3" />
    <path d="M101 151h16" strokeOpacity=".16" strokeWidth="1.1" />
  </g>;
}
