'use client';

import { Fragment, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight } from '@/components/icons';
import { heroHeadline as headline, heroDescription as description } from './heroCopy';
import './intro-motion.css';

function RevealText({ text, variant }: { text: string; variant: 'title' | 'copy' }) {
  const words = text.split(' ');

  return <>
    <span className="sr-only">{text}</span>
    <span className={`hero-reveal-text hero-reveal-${variant}`} aria-hidden="true">
      {words.map((word, index) => <Fragment key={`${index}-${word}`}>
        <span
          className={variant === 'title' ? 'hero-word-clip' : 'hero-copy-word'}
          style={{ '--word-index': index } as CSSProperties}
        >
          {variant === 'title'
            ? <span className="hero-reveal-word" data-word={word}>{word}</span>
            : <span className="hero-copy-word-content">{word}</span>}
        </span>
        {index < words.length - 1 ? ' ' : null}
      </Fragment>)}
    </span>
  </>;
}

function HeroAction({ href, label, icon, primary = false }: {
  href: string;
  label: string;
  icon: ReactNode;
  primary?: boolean;
}) {
  return <Link
    href={href}
    className={`hero-action hero-animated-action ${primary ? 'hero-action-primary' : 'hero-action-secondary'}`}
    style={{ '--action-stagger': primary ? '0ms' : '80ms' } as CSSProperties}
  >
    <span className="hero-action-content">{label}{icon}</span>
    <span className="hero-action-intro-label" aria-hidden="true">{label}{icon}</span>
  </Link>;
}

export function HeroIntro({ downloadHref }: { downloadHref: string }) {
  const introRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const intro = introRef.current;
    const paragraph = intro?.querySelector<HTMLElement>('.hero-subtext');
    if (!intro || !paragraph) return;

    let disposed = false;
    const measureLines = () => {
      if (disposed) return;
      let line = -1;
      let previousTop = -Infinity;

      // Measure the stationary wrappers so animation never affects line grouping.
      paragraph.querySelectorAll<HTMLElement>('.hero-copy-word').forEach(word => {
        const top = word.offsetTop;
        if (Math.abs(top - previousTop) > 1) {
          line += 1;
          previousTop = top;
        }
        word.style.setProperty('--line-index', String(line));
      });
      intro.style.setProperty('--hero-copy-last-line', String(Math.max(0, line)));
      paragraph.dataset.linesReady = 'true';
      intro.dataset.introReady = 'true';
    };

    measureLines();
    const observer = new ResizeObserver(measureLines);
    observer.observe(paragraph);
    void document.fonts.ready.then(measureLines);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, []);

  return <div className="hero-intro" ref={introRef}>
    <h1><RevealText text={headline} variant="title" /></h1>
    <p className="hero-subtext"><RevealText text={description} variant="copy" /></p>
    <div className="hero-intro-actions">
      <HeroAction href={downloadHref} label="Download" icon={<ArrowDown size={17} aria-hidden="true" />} primary />
      <HeroAction href="/home#workflow" label="Explore Trilorah" icon={<ArrowRight size={17} aria-hidden="true" />} />
    </div>
  </div>;
}
