'use client';

import { useEffect, useRef } from 'react';
import { mountTranscriptDemo } from '../transcript-demo';

/** Saved interactive hero preview, rendered from the exported desktop HTML/CSS. */
export function InteractiveAppPreview({ decorative = false, viewportWidth = 1440, viewportHeight = 900 }: { decorative?: boolean; viewportWidth?: number; viewportHeight?: number }) {
  const frame = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const resize = () => node.style.setProperty('--app-preview-scale', String(node.clientWidth / viewportWidth));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    const iframe = preview.current;
    let cleanupDemo: (() => void) | undefined;
    const initializeDemo = () => {
      cleanupDemo?.();
      const doc = iframe?.contentDocument;
      if (doc) {
        // The saved export fixes its canvas at 1440px; let the hero use a wider
        // native layout rather than stretching the text and controls.
        let sizing = doc.getElementById('hero-preview-sizing');
        if (!sizing) {
          sizing = doc.createElement('style');
          sizing.id = 'hero-preview-sizing';
          doc.head.appendChild(sizing);
        }
        sizing.textContent = `html, body, [data-shell] { width: ${viewportWidth}px !important; height: ${viewportHeight}px !important; }`;
        cleanupDemo = mountTranscriptDemo(doc);
      }
    };
    iframe?.addEventListener('load', initializeDemo);
    if (iframe?.contentDocument?.readyState === 'complete') initializeDemo();
    return () => {
      observer.disconnect();
      iframe?.removeEventListener('load', initializeDemo);
      cleanupDemo?.();
    };
  }, [viewportWidth, viewportHeight]);

  return (
    <div className="hero-app-frame hero-interactive-frame" ref={frame} style={{ aspectRatio: `${viewportWidth} / ${viewportHeight}` }}>
      <iframe
        ref={preview}
        src="/hero-preview/app.html"
        title="Trilorah desktop interface — visual preview"
        width={viewportWidth}
        style={{ width: viewportWidth, height: viewportHeight }}
        height={viewportHeight}
        sandbox="allow-same-origin"
        loading="eager"
        tabIndex={decorative ? -1 : undefined}
      />
    </div>
  );
}
