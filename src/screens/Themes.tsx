import { useEffect, useState } from 'react';
import { toDisplayUrl } from '../../shared/mediaUrl';
import { useAppStore } from '../stores/appStore';
import { Button, EngineNote, Panel, PanelHeader, SectionLabel, TextButton, hasEngine } from '../components/ui';

/**
 * Display themes for the output windows: scripture font, size, weight,
 * color, background, dim overlay. Every change saves immediately and
 * repaints the live output (on-theme-changed).
 */

function save(key: string, value: unknown) {
  void window.api?.setSetting(key, value).catch(() => undefined);
  useAppStore.getState().patchSetting(key, value);
}

const FONT_PRESETS: Array<{ id: string; label: string; family: string }> = [
  { id: 'display-serif', label: 'display serif', family: "Georgia, 'Times New Roman', serif" },
  { id: 'classic-serif', label: 'classic serif', family: "'Times New Roman', Georgia, serif" },
  { id: 'modern-sans', label: 'modern sans', family: "system-ui, -apple-system, sans-serif" },
  { id: 'bold-slab', label: 'bold slab', family: "'Alfa Slab One', Georgia, serif" },
  { id: 'display-rounded', label: 'rounded display', family: "'Paytone One', system-ui, sans-serif" },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
      <span className="w-40 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Themes() {
  const settings = useAppStore((s) => s.settings);
  const loaded = settings != null;
  const [bgNote, setBgNote] = useState<string | null>(null);
  const [versions, setVersions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void window.api?.getAvailableVersions?.()
      .then((v) => {
        if (!cancelled) setVersions(v ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const chooseImage = async () => {
    setBgNote(null);
    try {
      const res = await window.api?.pickBackgroundImage?.();
      if (res?.success && res.url) {
        useAppStore.getState().patchSetting('defaultBackgroundUrl', res.url);
        setBgNote('background updated');
      } else if (res && !res.canceled) {
        setBgNote(res.error ?? 'could not use that image');
      }
    } catch {
      setBgNote('could not open the image picker');
    }
  };

  if (!hasEngine()) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Themes</h2>
          <p className="text-sm text-neutral-500">
            Shape how scripture looks on the output — font, size, color, and background.
          </p>
        </div>
        <EngineNote what="engine not connected — theme settings live in the Electron main process" />
      </div>
    );
  }

  const preset = typeof settings?.scriptureFontPreset === 'string' ? settings.scriptureFontPreset : 'display-serif';
  const scale = typeof settings?.defaultFontSize === 'number' ? settings.defaultFontSize : 1;
  const weight = typeof settings?.defaultFontWeight === 'number' ? settings.defaultFontWeight : 400;
  const color = typeof settings?.defaultTextColor === 'string' ? settings.defaultTextColor : '#ffffff';
  const overlay = typeof settings?.overlayOpacity === 'number' ? settings.overlayOpacity : 0.3;
  const backgroundUrl = typeof settings?.defaultBackgroundUrl === 'string' ? settings.defaultBackgroundUrl : '';
  const bgFit = typeof settings?.backgroundFit === 'string' ? settings.backgroundFit : 'cover';
  const bgPosition = typeof settings?.backgroundPosition === 'string' ? settings.backgroundPosition : 'center';
  const bgSizeCss = bgFit === 'fill' ? '100% 100%' : bgFit;
  const family = FONT_PRESETS.find((f) => f.id === preset)?.family ?? FONT_PRESETS[0].family;
  // Passage layout (BUILD-MAP 2.18) — how a reading is cut into slides.
  const breakOnVerse = settings?.breakOnVerse === true;
  const showVerseNumbers = settings?.showVerseNumbers === true;
  const referenceMode = typeof settings?.referenceMode === 'string' ? settings.referenceMode : 'each';
  const showTranslation = settings?.showTranslation !== false;
  const maxChars = typeof settings?.maxCharsPerSlide === 'number' ? settings.maxCharsPerSlide : 0;
  const secondaryVersion = typeof settings?.secondaryVersion === 'string' ? settings.secondaryVersion : '';

  return (
    <div key={loaded ? 'loaded' : 'loading'} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Themes</h2>
        <p className="text-sm text-neutral-500">
          Shape how scripture looks on the output — every change saves instantly and repaints the
          live screen.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="self-start">
          <PanelHeader>scripture display</PanelHeader>
          <div className="space-y-4">
            <Row label="font">
              <select value={preset} onChange={(e) => save('scriptureFontPreset', e.target.value)} className="text-sm">
                {FONT_PRESETS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="size">
              <input
                type="range"
                min="0.6"
                max="1.8"
                step="0.05"
                defaultValue={String(scale)}
                onChange={(e) => save('defaultFontSize', Number.parseFloat(e.target.value))}
                className="w-56"
              />
              <span className="text-xs tabular-nums text-neutral-400">{Math.round(scale * 100)}%</span>
            </Row>
            <Row label="weight">
              <select value={String(weight)} onChange={(e) => save('defaultFontWeight', Number(e.target.value))} className="text-sm">
                {[300, 400, 500, 600, 700].map((w) => (
                  <option key={w} value={String(w)}>
                    {w}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="text color">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#ffffff'}
                onChange={(e) => save('defaultTextColor', e.target.value)}
                className="h-6 w-10 cursor-pointer border-none p-0"
              />
              <span className="text-xs text-neutral-400">{color}</span>
            </Row>
          </div>
        </Panel>

        <Panel className="self-start">
          <PanelHeader>passage layout</PanelHeader>
          <div className="space-y-4">
            <Row label="slides">
              <select
                value={breakOnVerse ? 'verse' : 'whole'}
                onChange={(e) => save('breakOnVerse', e.target.value === 'verse')}
                className="text-sm"
              >
                <option value="whole">whole passage on one slide</option>
                <option value="verse">one slide per verse</option>
              </select>
            </Row>
            <Row label="verse numbers">
              <select
                value={showVerseNumbers ? 'on' : 'off'}
                onChange={(e) => save('showVerseNumbers', e.target.value === 'on')}
                className="text-sm"
              >
                <option value="off">hidden</option>
                <option value="on">shown inline</option>
              </select>
            </Row>
            <Row label="reference">
              <select value={referenceMode} onChange={(e) => save('referenceMode', e.target.value)} className="text-sm">
                <option value="each">on every slide</option>
                <option value="first">on the first slide only</option>
                <option value="last">on the last slide only</option>
                <option value="none">never</option>
              </select>
            </Row>
            <Row label="translation">
              <select
                value={showTranslation ? 'on' : 'off'}
                onChange={(e) => save('showTranslation', e.target.value === 'on')}
                className="text-sm"
              >
                <option value="on">show beside the reference</option>
                <option value="off">hide</option>
              </select>
            </Row>
            <Row label="second translation">
              <select
                value={secondaryVersion}
                onChange={(e) => save('secondaryVersion', e.target.value)}
                className="text-sm"
              >
                <option value="">none</option>
                {versions.filter((v) => v !== settings?.displayVersion).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="split long verses">
              <input
                type="range"
                min="0"
                max="400"
                step="20"
                defaultValue={String(maxChars)}
                onChange={(e) => save('maxCharsPerSlide', Number.parseInt(e.target.value, 10))}
                className="w-56"
              />
              <span className="text-xs tabular-nums text-neutral-400">
                {maxChars > 0 ? `${maxChars} chars` : 'off'}
              </span>
            </Row>
            <p className="text-xs leading-relaxed text-neutral-500">
              Splitting only applies when each verse gets its own slide — asking for one slide and
              silently getting three would surprise the operator mid-service.
            </p>
          </div>
        </Panel>

        <Panel className="self-start">
          <PanelHeader>background</PanelHeader>
          <div className="space-y-4">
            <Row label="image">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
                <Button label="Choose image…" variant="solid" onClick={() => void chooseImage()} />
                {backgroundUrl && (
                  <TextButton label="REMOVE" onClick={() => { save('defaultBackgroundUrl', ''); setBgNote('background removed'); }} />
                )}
                {bgNote && <span className="text-xs text-neutral-400">{bgNote}</span>}
              </div>
            </Row>
            <Row label="or image url">
              <input
                key={backgroundUrl}
                defaultValue={backgroundUrl}
                placeholder="https://… or file:///… (empty = transparent for obs/vmix)"
                onBlur={(e) => save('defaultBackgroundUrl', e.target.value.trim())}
                className="min-w-0 flex-1 text-sm"
              />
            </Row>
            <Row label="image fit">
              <select value={bgFit} onChange={(e) => save('backgroundFit', e.target.value)} className="text-sm">
                <option value="cover">fill the screen (crop edges)</option>
                <option value="contain">fit inside (no cropping)</option>
                <option value="fill">stretch to screen</option>
              </select>
            </Row>
            <Row label="image position">
              <select value={bgPosition} onChange={(e) => save('backgroundPosition', e.target.value)} className="text-sm">
                <option value="center">center</option>
                <option value="top">top</option>
                <option value="bottom">bottom</option>
              </select>
            </Row>
            <Row label="dim overlay">
              <input
                type="range"
                min="0"
                max="0.9"
                step="0.05"
                defaultValue={String(overlay)}
                onChange={(e) => save('overlayOpacity', Number.parseFloat(e.target.value))}
                className="w-56"
              />
              <span className="text-xs tabular-nums text-neutral-400">{Math.round(overlay * 100)}%</span>
            </Row>
          </div>
        </Panel>
      </div>

      <Panel pad={false}>
        <div className="border-b border-hairline px-4 py-3">
          <SectionLabel>preview</SectionLabel>
        </div>
        <div
          className="relative flex min-h-64 flex-col items-center justify-center overflow-hidden px-10 py-12 text-center"
          style={{
            background: backgroundUrl
              ? `#000 url(${toDisplayUrl(backgroundUrl)}) ${bgPosition} / ${bgSizeCss} no-repeat`
              : '#1a1a1a',
          }}
        >
          {backgroundUrl && (
            <div className="absolute inset-0 bg-black" style={{ opacity: overlay }} />
          )}
          <p
            className="relative max-w-2xl leading-relaxed"
            style={{
              fontFamily: family,
              fontWeight: weight,
              color,
              fontSize: `${1.5 * scale}rem`,
            }}
          >
            For God so loved the world, that he gave his only begotten Son, that whosoever
            believeth in him should not perish, but have everlasting life.
          </p>
          <p
            className="relative mt-6 tracking-widest"
            style={{ fontFamily: family, color, fontSize: `${0.9 * scale}rem` }}
          >
            John 3:16
          </p>
        </div>
        <p className="border-t border-hairline px-4 py-3 text-xs text-neutral-400">
          changes apply to the live output instantly — open output from the live tab to see it full-screen
        </p>
      </Panel>
    </div>
  );
}
