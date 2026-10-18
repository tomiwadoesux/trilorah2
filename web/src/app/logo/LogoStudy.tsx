'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Download, RotateCcw } from '@/components/icons';
import './logo.css';

const pieces = [
  { file: 'circ', arrival: 'translate(-24px, 12px) rotate(-8deg) scale(.95)' },
  { file: 'rect', arrival: 'translate(0, -24px) rotate(-4deg) scale(.95)' },
  { file: 'tri', arrival: 'translate(24px, 12px) rotate(8deg) scale(.95)' },
] as const;

function StaticMark({ className = '', decorative = false }: { className?: string; decorative?: boolean }) {
  return <Image className={className} src="/brand/logo/trilorah-logo.svg" width={606} height={407} alt={decorative ? '' : 'Trilorah: overlapping circle, square, and triangle'} unoptimized />;
}

export default function LogoStudy() {
  const mark = useRef<HTMLDivElement>(null);
  const elements = useRef<(SVGGElement | null)[]>([]);
  const animations = useRef<Animation[]>([]);
  const run = useRef(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);

  const stop = useCallback(() => {
    ++run.current;
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];
  }, []);

  const play = useCallback((initial = false) => {
    if (!mark.current) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const styles = getComputedStyle(mark.current);
    const ease = styles.getPropertyValue(initial || reduce ? '--ease-out' : '--ease-in-out').trim();
    // Capture the visible position before cancellation so another replay
    // continues from what the user sees rather than snapping to frame one.
    const current = elements.current.map(element => element ? getComputedStyle(element) : null)
      .map(style => ({ transform: style?.transform ?? 'none', opacity: style?.opacity ?? '1' }));
    stop();
    const token = ++run.current;
    setReady(true);
    setPlaying(true);
    animations.current = elements.current.flatMap((element, index) => {
      if (!element) return [];
      const frames: Keyframe[] = reduce
        ? [{ opacity: initial ? 0 : current[index].opacity }, { opacity: 1 }]
        : initial
          ? [{ transform: pieces[index].arrival, opacity: 0 }, { transform: 'none', opacity: 1 }]
          : [current[index], { transform: pieces[index].arrival, opacity: .65, offset: .28 }, { transform: 'none', opacity: 1 }];
      return [element.animate(frames, {
        duration: reduce ? 160 : initial ? 700 : 900,
        delay: reduce ? 0 : index * 70,
        easing: ease,
        fill: 'both',
      })];
    });
    void Promise.all(animations.current.map(animation => animation.finished)).then(() => {
      if (token === run.current) setPlaying(false);
    }).catch(() => { /* Replays and preference changes intentionally cancel. */ });
  }, [stop]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(preference.matches);
    play(true);
    const onChange = () => {
      setReduced(preference.matches);
      stop();
      setReady(true);
      setPlaying(false);
    };
    preference.addEventListener('change', onChange);
    return () => {
      preference.removeEventListener('change', onChange);
      stop();
    };
  }, [play, stop]);

  return <div className="logo-page">
    <a className="logo-skip" href="#logo-main">Skip to logo</a>
    <header className="logo-header">
      <Link className="logo-home" href="/home"><StaticMark decorative /><span>Trilorah</span></Link>
      <span className="logo-header-label">Identity study <span>02</span></span>
      <Link className="logo-back" href="/home/navigation-preview">Navigation preview <ArrowUpRight size={14} /></Link>
    </header>

    <main id="logo-main" className="logo-main">
      <div className="logo-intro">
        <div><p className="logo-eyebrow">THE TRILORAH MARK</p><h1>Three shapes.<br />One Trilorah.</h1></div>
        <p>Your mark, exactly as drawn.<br />Brought to life with a little motion.</p>
      </div>

      <section className="logo-stage" aria-label="Animated Trilorah logo preview">
        <div className="logo-stage-top"><span>THE MARK</span><span className="logo-status"><i data-playing={playing} />{reduced ? 'Reduced motion' : playing ? 'Coming together' : 'Together'}</span></div>
        <div ref={mark} className="logo-mark" data-ready={ready} role="img" aria-label="Trilorah logo from Group 1227: overlapping circle, square, and triangle">
          <svg viewBox="0 -18 606 407" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <g id="Group 1227">
              <g ref={node => { elements.current[0] = node; }} className="logo-piece logo-piece-circ"><g className="logo-piece-art"><g id="circ">
                <circle id="Ellipse 40" cx="180.539" cy="188.539" r="128" transform="rotate(-53.2637 180.539 188.539)" fill="white" stroke="black" strokeWidth="4" />
                <circle id="Ellipse 42" cx="116.979" cy="138.978" r="43" transform="rotate(-53.2637 116.979 138.978)" fill="black" stroke="black" strokeWidth="4" />
              </g></g></g>
              <g ref={node => { elements.current[1] = node; }} className="logo-piece logo-piece-rect"><g className="logo-piece-art"><g id="rect" transform="translate(0 -16)">
                <rect id="Rectangle 574056973" x="202" y="257" width="256" height="256" transform="rotate(-90 202 257)" fill="white" stroke="black" strokeWidth="4" />
                <circle id="Ellipse 41" cx="386" cy="56" r="44" fill="black" stroke="black" strokeWidth="2" />
              </g></g></g>
              <g ref={node => { elements.current[2] = node; }} className="logo-piece logo-piece-tri"><g className="logo-piece-art"><g id="tri">
                <path id="Polygon 1" d="M584.641 314.75H334.359L459.5 98L584.641 314.75Z" fill="white" stroke="black" strokeWidth="4" />
                <circle id="Ellipse 43" cx="526" cy="207" r="44" fill="black" stroke="white" strokeWidth="2" />
              </g></g></g>
            </g>
          </svg>
        </div>
        <div className="logo-stage-bottom"><span>TRILORAH <span>/</span> 02</span><button type="button" onClick={() => play()}><RotateCcw size={15} /><span>Replay motion</span></button></div>
      </section>

      <div className="logo-applications">
        <section className="logo-application logo-lockup"><p className="logo-eyebrow">WITH THE NAME</p><div><StaticMark decorative /><span>Trilorah</span></div></section>
        <section className="logo-application logo-small"><p className="logo-eyebrow">AT A SMALLER SCALE</p><div><StaticMark className="logo-size-medium" /><StaticMark className="logo-size-small" /><StaticMark className="logo-size-tiny" /></div></section>
      </div>

      <footer className="logo-footer"><Link href="/home/navigation-preview"><ArrowLeft size={14} />Back to the header</Link><a href="/brand/logo/trilorah-logo.svg" download="trilorah-logo.svg">Download the SVG <Download size={15} /></a></footer>
    </main>
  </div>;
}
