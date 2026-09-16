import { useEffect, useRef, useState } from 'react';
import { cx, SearchField, SegmentedControl, type SegmentOption } from '../../ui';
import { PRESET_GROUPS, presetsIn, type PresetGroup, type StockPreset } from '../../lib/stockPresets';
import type { ThemeMedia } from './mediaLibrary';

/*
 * The search shelf of the media tab — a free stock library, from inside
 * the app.
 *
 * The shape is the presets first and the field second. A preacher planning
 * Psalm 23 reaches for SHEPHERD, not for a text box; the box is there for
 * the one in fifty searches a preset does not cover. Both end in the same
 * grid, drawn the way the other two shelves draw theirs, because a photo
 * from the internet and a photo from a USB stick are the same object once
 * they are on the projector.
 *
 * Picking is a download, not a link. The card says "saving" until the file
 * is on this laptop, and only then does the library learn about it — the
 * projector must never point at a URL that a church basement's wifi has
 * to resolve mid-service.
 */

type Kind = 'photo' | 'video';

const KINDS: SegmentOption<Kind>[] = [
  { id: 'photo', label: 'photos' },
  { id: 'video', label: 'video' },
];

const GROUPS: SegmentOption<PresetGroup>[] = PRESET_GROUPS.map((g) => ({ id: g.id, label: g.label }));

type Phase =
  | { at: 'idle' }
  | { at: 'loading' }
  | { at: 'ready'; items: StockItem[]; total: number; provider: StockProvider; more: boolean }
  | { at: 'error'; message: string };

export function StockSearch({ onPick }: { onPick: (media: ThemeMedia) => void }) {
  const [group, setGroup] = useState<PresetGroup>('creation');
  const [kind, setKind] = useState<Kind>('photo');
  const [preset, setPreset] = useState<StockPreset | null>(null);
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<Phase>({ at: 'idle' });
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState<string | null>(null);
  const [providers, setProviders] = useState<StockProvider[] | null>(null);

  /* The query is the preset's, or the operator's — never both. Typing
     clears the chip so the grid never claims to be showing "cross" while
     it is showing what was typed over it. */
  const query = preset ? preset.query : typed.trim();

  useEffect(() => {
    if (!window.api?.getStockProviders) {
      setProviders([]);
      return;
    }
    window.api.getStockProviders().then(setProviders);
  }, []);

  /* One in-flight search at a time wins. A slow answer for "cro" must not
     land on top of the answer for "cross". */
  const ticket = useRef(0);
  useEffect(() => {
    setPage(1);
    if (!query || !window.api?.searchStock) {
      setPhase({ at: 'idle' });
      return;
    }
    const mine = ++ticket.current;
    const delay = preset ? 0 : 400;
    const timer = setTimeout(() => {
      setPhase({ at: 'loading' });
      window.api!.searchStock!({ query, kind, page: 1 }).then((res) => {
        if (mine !== ticket.current) return;
        if (!res.success) {
          setPhase({ at: 'error', message: res.error });
          return;
        }
        setPhase({ at: 'ready', items: res.items, total: res.total, provider: res.provider, more: res.items.length < res.total });
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [query, kind, preset]);

  const loadMore = () => {
    if (phase.at !== 'ready' || !window.api?.searchStock) return;
    const next = page + 1;
    const mine = ticket.current;
    window.api.searchStock({ query, kind, page: next }).then((res) => {
      if (mine !== ticket.current || !res.success) return;
      setPage(next);
      setPhase((prev) =>
        prev.at === 'ready'
          ? { ...prev, items: [...prev.items, ...res.items], more: prev.items.length + res.items.length < res.total }
          : prev,
      );
    });
  };

  const pick = async (item: StockItem) => {
    if (saving || !window.api?.downloadStock) return;
    setSaving(item.id);
    const res = await window.api.downloadStock({ item });
    setSaving(null);
    if (!res.success || !res.url) {
      setPhase({ at: 'error', message: res.error ?? 'could not save that one' });
      return;
    }
    onPick({
      id: item.id,
      label: preset?.label ?? typed.trim() ?? item.tags,
      detail: item.credit,
      seed: 0,
      style: 'smoke',
      source: 'local',
      url: res.src ?? res.url,
      poster: item.thumb,
      kind: item.kind,
    });
  };

  const noEngine = !window.api?.searchStock;
  const noKey = providers !== null && providers.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* The two ways in, on one row: the vocabulary on the left, the field
          on the right, and the photo/video switch between them where it
          applies to both. */}
      <div className="flex shrink-0 items-center gap-3 px-1">
        <SegmentedControl options={GROUPS} value={group} onChange={setGroup} size="sm" />
        <SegmentedControl options={KINDS} value={kind} onChange={setKind} size="sm" />
        <SearchField
          value={typed}
          onChange={(v) => {
            setTyped(v);
            setPreset(null);
          }}
          placeholder="or search for anything…"
          disabled={noEngine || noKey}
          className="max-w-[320px]"
        />
      </div>

      {/* The presets of the chosen group. Chips, not a grid of pictures: the
          words are the point, and thirty pictures before the search has run
          would look like results. */}
      <div className="flex shrink-0 flex-wrap gap-1.5 px-1">
        {presetsIn(group).map((x) => {
          const on = preset?.id === x.id;
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                setPreset(on ? null : x);
                setTyped('');
              }}
              disabled={noEngine || noKey}
              aria-pressed={on}
              className={cx(
                'tri-rounded-control h-7 px-2.5 text-[length:var(--tri-size-xs)] lowercase transition-colors disabled:opacity-40',
                on
                  ? 'bg-[rgb(255_255_255_/_0.14)] text-[var(--tri-ink)]'
                  : 'bg-[rgb(255_255_255_/_0.05)] text-[rgb(229_243_242_/_0.6)] hover:bg-[rgb(255_255_255_/_0.09)] hover:text-[var(--tri-ink)]',
              )}
            >
              {x.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-3">
        {noEngine ? (
          <Note>no engine — the stock library needs the app running</Note>
        ) : noKey ? (
          <Note>add a pixabay or pexels key in settings to search the stock library</Note>
        ) : phase.at === 'idle' ? (
          <Note>pick a theme above, or search for anything</Note>
        ) : phase.at === 'error' ? (
          <Note>{phase.message}</Note>
        ) : phase.at === 'loading' ? (
          <div className="grid auto-rows-min grid-cols-5 gap-x-3 gap-y-4">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="pb-3">
                <div className="tri-rounded-control animate-pulse bg-[rgb(255_255_255_/_0.05)]" style={{ aspectRatio: '16 / 9' }} />
                <div className="mt-3 h-2.5 w-2/3 rounded bg-[rgb(255_255_255_/_0.05)]" />
              </div>
            ))}
          </div>
        ) : phase.items.length === 0 ? (
          <Note>nothing for “{query}” — try another word</Note>
        ) : (
          <>
            <div className="grid auto-rows-min grid-cols-5 gap-x-3 gap-y-4">
              {phase.items.map((item) => (
                <StockCard
                  key={item.id}
                  item={item}
                  title={preset?.label ?? typed.trim()}
                  saving={saving === item.id}
                  disabled={saving !== null}
                  onPick={() => pick(item)}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.34)]">
                {kind === 'video' ? 'video' : 'photos'} by {phase.provider}
              </span>
              {phase.more ? (
                <button
                  type="button"
                  onClick={loadMore}
                  className="tri-rounded-control h-7 bg-[rgb(255_255_255_/_0.06)] px-3 text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.7)] hover:bg-[rgb(255_255_255_/_0.1)] hover:text-[var(--tri-ink)]"
                >
                  more
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 py-6 text-[length:var(--tri-size-sm)] lowercase text-[rgb(229_243_242_/_0.42)]">{children}</p>
  );
}

function StockCard({
  item,
  title,
  saving,
  disabled,
  onPick,
}: {
  item: StockItem;
  title: string;
  saving: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  const mins = item.duration ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}` : null;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      className="group/card block w-full pb-3 text-left transition-transform duration-150 ease-out hover:-translate-y-[2px] disabled:hover:translate-y-0"
      style={{ boxShadow: 'inset 0 -1px 0 rgb(255 255 255 / 0.08)' }}
    >
      <span className="tri-rounded-control relative block overflow-hidden bg-black/40" style={{ aspectRatio: '16 / 9' }}>
        <img
          src={item.thumb}
          alt={item.tags}
          loading="lazy"
          className={cx(
            'h-full w-full object-cover transition-transform duration-200 group-hover/card:scale-[1.03]',
            saving && 'opacity-60',
          )}
        />
        <span
          className="tri-rounded-control pointer-events-none absolute inset-0 transition-shadow duration-150"
          style={{ boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.22)' }}
        />
        {saving ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-1 text-[10px] lowercase text-[var(--tri-accent-yellow)]">saving…</span>
        ) : mins ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-1 text-[10px] text-[rgb(229_243_242_/_0.8)]">{mins}</span>
        ) : null}
      </span>
      <span className="mt-2 block px-0.5">
        <span className="block truncate text-[length:var(--tri-size-sm)] font-semibold leading-[1.25] text-[rgb(229_243_242_/_0.86)] transition-colors group-hover/card:text-[var(--tri-ink)]">
          {title || item.tags.split(',')[0] || item.provider}
        </span>
        <span className="mt-[2px] block truncate text-[length:var(--tri-size-xs)] leading-[1.3] text-[rgb(229_243_242_/_0.42)]">{item.credit}</span>
      </span>
    </button>
  );
}
