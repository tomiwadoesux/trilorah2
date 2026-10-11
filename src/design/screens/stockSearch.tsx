import { STARTER_MEDIA } from '../../lib/starterMedia';
import './stockSearch.css';
import { EmptyMark } from './emptyArt';
import { GlobeEmptyArt } from './GlobeEmptyArt';
import { stockSearchQuery } from '../../../shared/stockSearchQuery';
import { useEffect, useRef, useState } from 'react';
import { cx, Button, SearchField, SegmentedControl, type SegmentOption } from '../../ui';
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

export function MediaKindPicker({ value, onChange }: { value: Kind; onChange: (kind: Kind) => void }) {
  return <div className="stock-kind-picker tri-rounded-control" role="group" aria-label="media type">
    <button type="button" aria-pressed={value === 'photo'} onClick={() => onChange('photo')}>pictures</button>
    <button type="button" aria-pressed={value === 'video'} onClick={() => onChange('video')}>videos</button>
  </div>;
}

const GROUPS: SegmentOption<PresetGroup>[] = PRESET_GROUPS.map((g) => ({ id: g.id, label: g.label }));

type Phase =
  | { at: 'idle' }
  | { at: 'loading' }
  | { at: 'ready'; items: StockItem[]; total: number; provider: StockProvider; more: boolean }
  | { at: 'error'; message: string };

export function StockSearch({ onPick, searchQuery, searchMode = 'media', mediaKind, onOpenSettings, flow = false }: { onOpenSettings?: () => void; onPick: (media: ThemeMedia) => void; searchQuery?: string; searchMode?: 'themes' | 'media'; mediaKind?: Kind;
  /** Grow with the results and let the parent scroll, instead of scrolling inside a fixed box. */
  flow?: boolean }) {
  const [group, setGroup] = useState<PresetGroup>('creation');
  const [localKind, setKind] = useState<Kind>('photo');
  const kind = mediaKind ?? localKind;
  const [preset, setPreset] = useState<StockPreset | null>(null);
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<Phase>({ at: 'idle' });
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState<string | null>(null);
  const [providers, setProviders] = useState<StockProvider[] | null>(null);
  const [providerError, setProviderError] = useState(false);
  const [providerAttempt, setProviderAttempt] = useState(0);

  /* The query is the preset's, or the operator's — never both. Typing
     clears the chip so the grid never claims to be showing "cross" while
     it is showing what was typed over it. */
  const embedded = searchQuery !== undefined;
  const hasSearch = !!(embedded ? searchQuery.trim() : preset?.query || typed.trim());
  const query = embedded ? stockSearchQuery(searchQuery, searchMode) : preset ? preset.query : typed.trim();

  useEffect(() => {
    if (!window.api?.getStockProviders) {
      setProviders([]);
      return;
    }
    let alive = true;
    const refresh = () => { setProviderError(false); return window.api!.getStockProviders!().then(value => { if (alive) setProviders(value); }).catch(() => { if (alive) { setProviders(null); setProviderError(true); } }); };
    void refresh();
    window.addEventListener('trilorah-stock-credentials-changed', refresh);
    return () => { alive = false; window.removeEventListener('trilorah-stock-credentials-changed', refresh); };
  }, [providerAttempt]);

  /* One in-flight search at a time wins. A slow answer for "cro" must not
     land on top of the answer for "cross". */
  const ticket = useRef(0);
  useEffect(() => {
    const mine = ++ticket.current;
    setPage(1);
    if (!hasSearch || !query || !window.api?.searchStock || !providers?.length) {
      setPhase({ at: 'idle' });
      return;
    }
    setPhase({ at: 'loading' });
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
      }).catch(() => { if (mine === ticket.current) setPhase({ at: 'error', message: 'Search is unavailable. Check your connection and try again.' }); });
    }, delay);
    return () => clearTimeout(timer);
  }, [query, kind, preset, hasSearch, providers]);

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
    }).catch(() => { if (mine === ticket.current) setPhase({ at: 'error', message: 'Could not load more results. Please try again.' }); });
  };

  const pick = async (item: StockItem) => {
    if (saving || !window.api?.downloadStock) return;
    setSaving(item.id);
    let res;
    try { res = await window.api.downloadStock({ item }); }
    catch { setPhase({ at: 'error', message: 'Could not save this media. Please try again.' }); return; }
    finally { setSaving(null); }
    if (!res.success || !res.url) {
      setPhase({ at: 'error', message: res.error ?? 'could not save that one' });
      return;
    }
    onPick({
      id: item.id,
      label: (searchQuery ?? preset?.label ?? typed.trim()) || item.tags,
      detail: item.credit,
      seed: 0,
      style: 'smoke',
      source: 'local',
      url: res.src ?? res.url,
      poster: item.thumb,
      kind: item.kind,
    });
    window.dispatchEvent(new CustomEvent('trilorah-guide-observed', { detail: 'stock-picked' }));
  };

  const noEngine = !window.api?.searchStock;
  const noKey = providers !== null && providers.length === 0;

  return (
    <div data-guide="stock-search" data-guide-state={!window.api?.searchStock ? 'offline' : providerError ? 'error' : providers === null ? 'checking' : !providers.length ? 'missing-key' : phase.at === 'ready' && !phase.items.length ? 'empty' : phase.at} className={cx("stock-search relative flex flex-col gap-3", !flow && "h-full min-h-0")}>
      {mediaKind === undefined && <MediaKindPicker value={kind} onChange={setKind} />}
      {/* Embedded libraries provide their own search and media type controls. */}
      {!embedded && <div className="stock-search__toolbar flex shrink-0 flex-wrap items-center gap-3 px-1">
        <SegmentedControl options={GROUPS} value={group} onChange={setGroup} size="sm" />
        <SearchField
          value={typed}
          onChange={(v) => {
            setTyped(v);
            setPreset(null);
          }}
          placeholder="or search for anything…"
          ariaLabel="search online media"
          disabled={noEngine || noKey || providers === null}
          className="min-w-[180px] max-w-[320px] flex-1"
        />
        {(noEngine || noKey) && onOpenSettings && <Button guideId="stock-setup" label="set up search" onClick={onOpenSettings} />}
      </div>}

      {providerError && <div role="alert" className="flex items-center gap-3 px-1 text-xs text-[var(--tri-ink-muted)]">Couldn’t check online search. <Button label="try again" onClick={() => setProviderAttempt(value => value + 1)} /></div>}
      {/* The presets of the chosen group. Chips, not a grid of pictures: the
          words are the point, and thirty pictures before the search has run
          would look like results. */}
      {!embedded && !noEngine && !noKey && <div className="stock-search__presets flex shrink-0 gap-1.5 px-1">
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
              disabled={noEngine || noKey || providers === null}
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
      </div>}

      <div className={cx("px-1", !flow && "min-h-0 flex-1 overflow-y-auto")}>
        {!hasSearch && kind === 'photo' ? (
          <div className="stock-results-grid grid auto-rows-min gap-2">
            {STARTER_MEDIA.map(media => <button key={media.id} type="button" className="stock-picture-card tri-rounded-control overflow-hidden bg-black/30" aria-label={`${media.label} — ${media.detail}`} onClick={() => onPick(media)}>
              <img src={media.url} alt="" className="aspect-[4/3] w-full object-cover"/>
            </button>)}
          </div>
        ) : noEngine ? (
          <OnlineEmpty line="find something for the room" hint="set up a photo library to search images and clips" onSetup={onOpenSettings} />
        ) : noKey ? (
          <OnlineEmpty line="connect your photo library" hint="add a Pixabay or Pexels key in settings to get started" onSetup={onOpenSettings} />
        ) : phase.at === 'idle' ? (
          <OnlineEmpty line="find something for the room" hint="pick a theme above, or search for an image or clip" />
        ) : phase.at === 'error' ? (
          <OnlineEmpty line="search could not load" hint={phase.message} onSetup={onOpenSettings} />
        ) : phase.at === 'loading' ? (
          <div className="stock-results-grid grid auto-rows-min gap-2">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i}>
                <div className="tri-rounded-control animate-pulse bg-[rgb(255_255_255_/_0.05)]" style={{ aspectRatio: '16 / 9' }} />
              </div>
            ))}
          </div>
        ) : phase.items.length === 0 ? (
          <OnlineEmpty line="nothing found yet" hint={`nothing for “${query}” — try another word`} />
        ) : (
          <>
            <div className="stock-results-grid grid auto-rows-min gap-2">
              {phase.items.map((item) => (
                <StockCard
                  key={item.id}
                  item={item}
                  title={searchQuery ?? preset?.label ?? typed.trim()}
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

function OnlineEmpty({ line, hint, onSetup }: { line: string; hint: string; onSetup?: () => void }) {
  return <div className="h-full min-h-0"><EmptyMark plain art={<GlobeEmptyArt />} w={180} h={160} line={line} hint={hint}
    below={onSetup ? <div className="mt-3"><Button guideId="stock-setup" label="set up online search" onClick={onSetup} /></div> : undefined} /></div>;
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
  const [imageFailed, setImageFailed] = useState(false);
  const [usePreview, setUsePreview] = useState(false);
  const mins = item.duration ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}` : null;
  return (
    <button
      type="button"
      data-guide="stock-result"
      onClick={onPick}
      disabled={disabled}
      aria-label={`${item.tags || title} — ${item.credit}`}
      className="stock-picture-card group/card relative block w-full overflow-hidden text-left tri-rounded-control"
    >
      <span className="tri-rounded-control relative block overflow-hidden bg-black/40" style={{ aspectRatio: '16 / 9' }}>
        {!imageFailed && <img
          src={usePreview ? item.preview : item.thumb}
          onError={() => { if (!usePreview && item.kind === 'photo' && item.preview !== item.thumb) setUsePreview(true); else setImageFailed(true); }}
          alt={item.tags}
          loading="lazy"
          className={cx(
            'h-full w-full object-cover',
            saving && 'opacity-60',
          )}
        />}
        {imageFailed && <span aria-hidden className="absolute inset-0 grid place-items-center text-white/40">◇</span>}
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
    </button>
  );
}
