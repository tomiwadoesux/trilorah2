import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchVerseText, formatRef, sameRef } from './lib/verse';
import './output.css';

/**
 * The projector / stream window: a transparent surface that fades scripture
 * in and out. Multiple outputs are distinguished by ?outputId=…, which is
 * parsed (and stamped on <body> for the main process / tests) but never shown.
 */

const outputId = new URLSearchParams(window.location.search).get('outputId') ?? '';
document.body.dataset.outputId = outputId;

interface Shown {
  detection: VerseDetection;
  text: string | null;
  isPreview: boolean;
}

function OutputSurface() {
  // `shown` keeps the last verse during fade-out; `visible` drives opacity.
  const [shown, setShown] = useState<Shown | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const api = window.api;
    if (!api) return;

    const display = (detection: VerseDetection, isPreview: boolean) => {
      setShown({ detection, text: null, isPreview });
      setVisible(true);
      void fetchVerseText(detection).then((text) => {
        if (text == null) return;
        setShown((current) =>
          current && sameRef(current.detection, detection) ? { ...current, text } : current,
        );
      });
    };

    const subs: ((() => void) | undefined)[] = [
      api.onVersePreview((d) => display(d, true)),
      api.onVerseDetected((d) => display(d, false)),
      api.onVerseAutoDismiss(() => setVisible(false)),
      api.onShowCleanBackground(() => setVisible(false)),
    ];

    return () => {
      for (const unsub of subs) unsub?.();
    };
  }, []);

  return (
    <>
      <div className={`output-stage ${visible ? 'visible' : ''}`}>
        {shown && (
          <>
            {shown.isPreview && <div className="output-preview-mark">preview</div>}
            {shown.text && <div className="output-verse">{shown.text}</div>}
            <div className="output-ref">
              {formatRef(shown.detection)}
              {shown.detection.version && (
                <span className="output-version">{shown.detection.version}</span>
              )}
            </div>
          </>
        )}
      </div>
      {!window.api && <div className="output-disconnected">output · engine not connected</div>}
    </>
  );
}

const rootEl = document.getElementById('output-root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <OutputSurface />
    </StrictMode>,
  );
}
