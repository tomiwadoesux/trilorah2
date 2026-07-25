import { useAppStore } from '../stores/appStore';
import { EngineNote, Panel, PanelHeader, SectionLabel, hasEngine } from '../components/ui';

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
  const family = FONT_PRESETS.find((f) => f.id === preset)?.family ?? FONT_PRESETS[0].family;

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
          <PanelHeader>background</PanelHeader>
          <div className="space-y-4">
            <Row label="image url">
              <input
                defaultValue={backgroundUrl}
                placeholder="https://… or file:///… (empty = transparent for obs/vmix)"
                onBlur={(e) => save('defaultBackgroundUrl', e.target.value.trim())}
                className="min-w-0 flex-1 text-sm"
              />
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
            background: backgroundUrl ? `#000 url(${backgroundUrl}) center / cover` : '#1a1a1a',
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
