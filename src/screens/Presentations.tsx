import { useEffect, useState } from 'react';
import {
  Button,
  EmptyState,
  EngineNote,
  Panel,
  Pill,
  SectionLabel,
  TextButton,
  hasEngine,
} from '../components/ui';

/**
 * Presentations: import a PPTX (converted to slide images by the engine,
 * OCR'd for media matching), browse slides, and push any slide to the
 * output windows. Slides land full-bleed on the output; CLEAR restores
 * the clean background.
 */

interface Presentation {
  id: string;
  title: string;
  slides: string[]; // absolute image paths
  pptxPath?: string;
  importedAt: number;
}

export function Presentations() {
  const [items, setItems] = useState<Presentation[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const [showing, setShowing] = useState<string | null>(null);

  useEffect(() => {
    void window.api?.loadPresentations()
      .then((loaded) => {
        if (Array.isArray(loaded)) setItems(loaded as Presentation[]);
      })
      .catch(() => undefined);
  }, []);

  const persist = (next: Presentation[]) => {
    setItems(next);
    void window.api?.savePresentations(next).catch(() => undefined);
  };

  const importPptx = async () => {
    setNote('converting… (this can take a moment)');
    try {
      const res = await window.api?.importPresentation();
      if (res?.success && res.data) {
        const next: Presentation = {
          id: `pres-${Date.now()}`,
          title: res.data.title,
          slides: res.data.slides,
          pptxPath: res.data.pptxPath,
          importedAt: Date.now(),
        };
        persist([...items, next]);
        setOpenId(next.id);
        setNote(`imported ${res.data.slides.length} slides`);
      } else {
        setNote(res?.error ?? 'import failed');
      }
    } catch {
      setNote('import failed');
    }
  };

  const openPresentation = (p: Presentation) => {
    const next = openId === p.id ? null : p.id;
    setOpenId(next);
    if (next) {
      // Load thumbnails lazily, once per slide.
      for (const slide of p.slides) {
        if (!thumbs[slide]) {
          void window.api?.readImageDataUrl(slide).then((dataUrl) => {
            if (dataUrl) setThumbs((t) => ({ ...t, [slide]: dataUrl }));
          }).catch(() => undefined);
        }
      }
    }
  };

  const showSlide = (slide: string) => {
    void window.api?.showMedia?.(slide).then(() => setShowing(slide)).catch(() => undefined);
  };

  const clear = () => {
    void window.api?.clearMedia?.().then(() => setShowing(null)).catch(() => undefined);
  };

  if (!hasEngine()) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Presentations</h2>
          <p className="text-sm text-neutral-500">
            Import a PPTX, browse its slides, and push any slide straight to the output windows.
          </p>
        </div>
        <EngineNote what="engine not connected — presentation import runs in the Electron main process" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Presentations</h2>
        <p className="text-sm text-neutral-500">
          Import a PPTX, browse its slides, and push any slide straight to the output windows.
        </p>
      </div>

      <Panel>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button label="Import PPTX" variant="solid" onClick={() => void importPptx()} />
          {showing && <TextButton label="CLEAR OUTPUT" onClick={clear} />}
          {note && <span className="text-sm text-neutral-500">{note}</span>}
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          pptx → slide images (needs libreoffice for conversion) · slides are ocr'd so the agent can
          suggest them during announcements
        </p>
      </Panel>

      <Panel pad={false}>
        <div className="border-b border-hairline px-4 py-3">
          <SectionLabel>library</SectionLabel>
        </div>
        {items.length === 0 && (
          <div className="px-4 py-4">
            <EmptyState>nothing imported yet</EmptyState>
          </div>
        )}
        {items.map((p) => (
          <div key={p.id} className="border-b border-hairline last:border-b-0">
            <div className="flex flex-wrap items-baseline gap-x-4 px-4 py-3">
              <button
                type="button"
                onClick={() => openPresentation(p)}
                className={`text-sm underline-offset-4 hover:underline ${openId === p.id ? 'font-semibold' : ''}`}
              >
                {p.title}
              </button>
              <Pill>{p.slides.length} slides</Pill>
              <span className="ml-auto">
                <TextButton
                  label="REMOVE"
                  onClick={() => {
                    void window.api?.deletePresentation({ id: p.id, slides: p.slides }).catch(() => undefined);
                    persist(items.filter((x) => x.id !== p.id));
                    if (openId === p.id) setOpenId(null);
                  }}
                />
              </span>
            </div>
            {openId === p.id && (
              <div className="grid grid-cols-3 gap-4 border-t border-hairline bg-paper px-4 py-4 sm:grid-cols-4 md:grid-cols-5">
                {p.slides.map((slide, i) => (
                  <button
                    key={slide}
                    type="button"
                    onClick={() => showSlide(slide)}
                    className={`group space-y-1 text-left ${showing === slide ? 'opacity-100' : ''}`}
                    title="show on output"
                  >
                    {thumbs[slide] ? (
                      <img
                        src={thumbs[slide]}
                        alt={`slide ${i + 1}`}
                        className={`w-full rounded-sm border ${showing === slide ? 'border-ink' : 'border-hairline'} group-hover:border-neutral-400`}
                      />
                    ) : (
                      <div className="flex aspect-video w-full items-center justify-center rounded-sm border border-hairline bg-surface text-xs text-neutral-400">
                        {i + 1}
                      </div>
                    )}
                    <span
                      className={`block text-[10px] uppercase tracking-widest ${
                        showing === slide ? 'font-bold text-accent' : 'text-neutral-400'
                      }`}
                    >
                      {showing === slide ? '● live' : `slide ${i + 1}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </Panel>
    </div>
  );
}
