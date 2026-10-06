import { useLayoutEffect, useRef } from 'react';
import { createGlobeRotation } from '../../lib/globeRotation';
import './globeEmptyArt.css';

const RAD = Math.PI / 180;
const RADIUS = 76;
const ELEVATION = 17 * RAD;
const LONGITUDES = Array.from({ length: 12 }, (_, index) => index * 30 * RAD);

type Point = { x: number; y: number; depth: number };

function project(latitude: number, longitude: number): Point {
  const x = RADIUS * Math.cos(latitude) * Math.sin(longitude);
  const y = RADIUS * Math.sin(latitude);
  const z = RADIUS * Math.cos(latitude) * Math.cos(longitude);
  return {
    x: 150 + x,
    y: 132 - y * Math.cos(ELEVATION) + z * Math.sin(ELEVATION),
    depth: y * Math.sin(ELEVATION) + z * Math.cos(ELEVATION),
  };
}

/** Split at the horizon so the far-side meridians remain appropriately faint. */
function trace(points: Point[], front: boolean) {
  let drawing = false;
  return points.map((point) => {
    if ((point.depth >= 0) !== front) {
      drawing = false;
      return '';
    }
    const command = drawing ? 'L' : 'M';
    drawing = true;
    return `${command}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join('');
}

function longitudePaths(angle: number) {
  return LONGITUDES.map((longitude) => {
    const points = Array.from({ length: 91 }, (_, index) => project((-90 + index * 2) * RAD, longitude + angle));
    return { far: trace(points, false), near: trace(points, true) };
  });
}

const LATITUDES = [-60, -30, 0, 30, 60].map((latitude) => {
  const points = Array.from({ length: 181 }, (_, index) => project(latitude * RAD, index * 2 * RAD));
  return { far: trace(points, false), near: trace(points, true) };
});
const INITIAL_LONGITUDES = longitudePaths(0);

/** Upright wire globe. Longitudes rotate through real projected 3D positions. */
export function GlobeEmptyArt() {
  const root = useRef<SVGSVGElement>(null);
  const near = useRef<Array<SVGPathElement | null>>([]);
  const far = useRef<Array<SVGPathElement | null>>([]);
  const angle = useRef(0);

  useLayoutEffect(() => {
    const svg = root.current;
    if (!svg) return;
    const surface = svg.closest<HTMLElement>('.tri-empty-surface');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = matchMedia('(hover: hover) and (pointer: fine)');
    let hovered = svg.matches(':hover');
    let focused = svg.contains(document.activeElement);
    const rotation = createGlobeRotation((phase) => {
      angle.current = phase;
      longitudePaths(phase).forEach((paths, index) => {
        near.current[index]?.setAttribute('d', paths.near);
        far.current[index]?.setAttribute('d', paths.far);
      });
    }, undefined, angle.current);

    const sync = () => {
      const suspended = document.hidden || reduced.matches;
      const requested = (hovered && pointer.matches) || focused || surface?.dataset.emptyActive === 'true';
      rotation.setActive(!suspended && requested, suspended);
    };
    const enter = () => { hovered = true; sync(); };
    const leave = () => { hovered = false; sync(); };
    const focusIn = () => { focused = true; sync(); };
    const focusOut = (event: FocusEvent) => {
      focused = event.relatedTarget instanceof Node && svg.contains(event.relatedTarget);
      sync();
    };
    const observer = new MutationObserver(sync);
    if (surface) observer.observe(surface, { attributes: true, attributeFilter: ['data-empty-active'] });
    svg.addEventListener('pointerenter', enter);
    svg.addEventListener('pointerleave', leave);
    svg.addEventListener('focusin', focusIn);
    svg.addEventListener('focusout', focusOut);
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    pointer.addEventListener('change', sync);
    sync();
    return () => {
      rotation.dispose();
      observer.disconnect();
      svg.removeEventListener('pointerenter', enter);
      svg.removeEventListener('pointerleave', leave);
      svg.removeEventListener('focusin', focusIn);
      svg.removeEventListener('focusout', focusOut);
      document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener('change', sync);
      pointer.removeEventListener('change', sync);
    };
  }, []);

  return (
    <svg ref={root} className="tri-globe-art" viewBox="32 29 236 223" aria-hidden="true" focusable="false">
      <ellipse cx="150" cy="229" rx="42" ry="7" fill="none" strokeOpacity=".12" strokeWidth=".6" />
      <path d="M48 132A102 31 0 0 1 252 132" fill="none" strokeOpacity=".28" strokeWidth=".8" />
      <path d="M48 135A102 31 0 0 1 252 135" fill="none" strokeOpacity=".12" strokeWidth=".55" />
      <circle cx="150" cy="132" r="76" fill="#151515" strokeOpacity=".74" strokeWidth=".85" />
      <g className="tri-globe-art__mesh" fill="none">
        {LATITUDES.map((paths, index) => (
          <path key={`latitude-far-${index}`} d={paths.far} strokeOpacity=".13" strokeWidth=".55" />
        ))}
        {INITIAL_LONGITUDES.map((paths, index) => (
          <path key={`longitude-far-${index}`} ref={(path) => { far.current[index] = path; }} d={paths.far} strokeOpacity=".13" strokeWidth=".55" />
        ))}
        {LATITUDES.map((paths, index) => (
          <path key={`latitude-near-${index}`} d={paths.near} strokeOpacity={index === 2 ? '.72' : '.43'} strokeWidth={index === 2 ? '.8' : '.65'} />
        ))}
        {INITIAL_LONGITUDES.map((paths, index) => (
          <path key={`longitude-near-${index}`} ref={(path) => { near.current[index] = path; }} d={paths.near} strokeOpacity=".43" strokeWidth=".65" />
        ))}
        <path d="M150 49V57M150 207V215" strokeOpacity=".63" strokeWidth=".8" />
        <circle cx="150" cy="48" r="2.2" fill="#1c1c1c" strokeOpacity=".8" strokeWidth=".7" />
        <circle cx="150" cy="216" r="2.2" fill="#1c1c1c" strokeOpacity=".57" strokeWidth=".7" />
      </g>
      <g fill="none">
        <path d="M48 132A102 31 0 0 0 252 132L252 135A102 31 0 0 1 48 135Z" fill="#1c1c1c" strokeOpacity=".42" strokeWidth=".65" />
        <path d="M48 132A102 31 0 0 0 252 132" strokeOpacity=".88" strokeWidth=".85" />
        <path d="M52 141L55 139M70 153L72 150M98 160L99 157M150 163V160M201 160L200 157M230 153L228 150M248 141L245 139" strokeOpacity=".55" strokeWidth=".6" />
      </g>
    </svg>
  );
}
