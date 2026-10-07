import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../ui';
import { useProjector, type LiveItem, type LiveSource } from './projector';

/*
 * The shape four of the five tabs share.
 *
 *   search  →  pick a container  →  step through its ordered items
 *           →  preview one  →  send it to the projector
 *
 * Scriptures is book+chapter → verses. Songs is a song → sections. Media and
 * presentations are the same again with a different noun in the middle. What
 * differs between them is genuinely only three things: how you search, what a
 * container is, and how one item draws. Everything else — the layout, the
 * rules between panes, the selection model, the keyboard, the gap between
 * looking and showing — was being written out once per tab and had already
 * started to drift: scriptures called it `preview` and songs called it
 * `selected`, for the same idea.
 *
 * These are two pieces on purpose rather than one big component. The layout
 * and the selection behaviour are useful separately: a tab can take the
 * keyboard model without accepting the two-pane frame, and vice versa.
 */

const HEADER_RULE = 'inset 0 -1px 0 rgb(255 255 255 / 0.09)';
const COLUMN_RULE = 'inset -1px 0 0 rgb(255 255 255 / 0.07)';

/** Keep the search row visible while unavailable, with no pointer or keyboard actions. */
export function LibrarySearch({ disabled = false, children }: { disabled?: boolean; children: ReactNode }) {
  return (
    <fieldset disabled={disabled} inert={disabled || undefined} aria-label="library search" aria-disabled={disabled || undefined}
      className="m-0 flex min-w-0 flex-1 items-center gap-[var(--tri-gap)] border-0 p-0"
      style={{ opacity: disabled ? 0.35 : 1 }}>
      {children}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export interface LibraryPaneProps {
  /**
   * The uppercase column header. A node, so a pane can carry two columns.
   * Omit it and the band stays — it is the rule that separates the search
   * from the content — but carries nothing.
   */
  title?: ReactNode;
  align?: 'left' | 'center';
  /** Fixed width in px; omit to take the remaining space. */
  width?: number;
  /** Pinned to the foot of the pane — "add song" and friends. */
  footer?: ReactNode;
  /** Draw the rule on the right edge. Off for the last pane. */
  rule?: boolean;
  /**
   * Draw the header band at all. Off for a pane whose content is its own
   * heading — a grid of titled cards does not need a word above it saying
   * what they are.
   */
  header?: boolean;
  /**
   * Whether the pane scrolls its own content. Off when the child is already
   * a scroller of its own — nesting two is how a list ends up with an inner
   * region that scrolls while the outer one also can, and neither reaches
   * the end.
   */
  scroll?: boolean;
  children: ReactNode;
}

export function LibraryPane({
  title,
  align = 'left',
  width,
  footer,
  rule = false,
  header = true,
  scroll = true,
  children,
}: LibraryPaneProps) {
  return (
    <div
      className={cx('flex min-h-0 flex-col', width ? 'shrink-0' : 'min-w-0 flex-1')}
      style={{ width, boxShadow: rule ? COLUMN_RULE : undefined }}
    >
      {header ? (
        <div
          className={cx(
            'flex shrink-0 items-center gap-4 px-4 py-3',
            'text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.18em] text-[rgb(229_243_242_/_0.42)]',
            align === 'center' && 'justify-center',
          )}
          style={{ boxShadow: HEADER_RULE }}
        >
          {title}
        </div>
      ) : null}
      <div className={cx('min-h-0 flex-1', scroll ? 'overflow-y-auto' : 'overflow-hidden')}>
        {children}
      </div>
      {footer && <div className="shrink-0 p-2">{footer}</div>}
    </div>
  );
}

export interface LibraryBrowserProps {
  /** Whatever control finds things in this library. */
  search: ReactNode;
  /**
   * Optionally frame the panes when they need a separate boundary inside
   * their parent panel.
   */
  framed?: boolean;
  /**
   * The tab's full-width action capsule, above optional search.
   */
  dock?: ReactNode;
  /** Space between the toolbar, search field, and library contents. */
  gap?: number;
  /** One or more LibraryPane. */
  children: ReactNode;
}

export function LibraryBrowser({ search, framed = false, dock, gap, children }: LibraryBrowserProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-[var(--tri-gap)]" style={{ gap }}>
      {/*
        -mx-3 cancels the Panel body's padding so the row can reach both edges,
        and px-4 then puts it back on the same inset the column headers use —
        which is also the panel's own top inset, so the content sits the same
        distance from the left edge as it does from the top.
        The version picker starts where REFERENCE starts and the field ends
        where the text column ends, so the row reads as part of the table
        rather than as something floating above it.
      */}
      <div className={cx(
        '-mx-3 flex shrink-0 gap-[var(--tri-gap)] px-4',
        dock ? 'flex-col items-stretch' : 'items-center justify-center',
      )} style={{ gap }}>
        {dock}
        {search}
      </div>
      <div
        className={cx(
          'relative -mx-3 flex min-h-0 flex-1 overflow-hidden',
          framed && 'tri-rounded-surface',
        )}
        style={framed ? { boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.055)' } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

export interface LibrarySelection {
  /** Index of the item being looked at, or null. */
  preview: number | null;
  /**
   * Move the selection. `mirror` is on for a deliberate move — a click, an
   * arrow — which anything watching may reflect. It is off when the selection
   * is only catching up with something the operator already did, such as
   * typing a verse number: echoing that back into the field they are typing
   * in would rewrite it under their hands.
   */
  setPreview: (i: number, mirror?: boolean) => void;
  /**
   * Move the highlight only — no staging, no echo into the field. For a list
   * catching up with something that already happened elsewhere, such as a
   * verse going live from the engine: the arrows then carry on from it, and
   * the preview box keeps whatever the operator had there.
   */
  point: (i: number) => void;
  /** Whether the arrows have been used since the list last changed. */
  navigated: boolean;
  /** ↑/↓, clamped to the ends of the list. */
  navigate: (delta: -1 | 1) => void;
  /** Enter. False when nothing is selected to act on. */
  activate: () => boolean;
  /** Commit index i to the projector. */
  send: (i: number) => void;
  isLive: (i: number) => boolean;
  /** Attach to the scroll container so the selection can be kept in view. */
  listRef: React.RefObject<HTMLDivElement | null>;
}

export interface UseLibrarySelectionOptions<T> {
  items: T[];
  source: LiveSource;
  /** Stable id for an item — what the projector remembers. */
  idOf: (item: T, index: number) => string;
  labelOf: (item: T, index: number) => string;
  /** Called when the selection moves, for anything that mirrors it. */
  onPreviewChange?: (item: T, index: number) => void;
  /** Select the first item whenever the list changes. */
  selectFirst?: boolean;
  /**
   * The item's CONTENT — the words, not just its name.
   *
   * Without this, selecting a row moved a highlight and nothing else, which
   * is why "preview" meant nothing outside the list it happened in. With it,
   * the same act puts the thing in the preview box where the operator can
   * look at it before deciding. A source that has no content to give omits
   * it and keeps the old behaviour exactly.
   */
  contentOf?: (item: T, index: number) => Partial<LiveItem>;
}

/**
 * The selection model every source shares: one thing being looked at, one
 * thing showing, and a deliberate gesture between them. A single stray click
 * must never reach the congregation, which is why previewing and sending are
 * different acts rather than the same act with a confirmation.
 */
export function useLibrarySelection<T>({
  items,
  source,
  idOf,
  labelOf,
  onPreviewChange,
  selectFirst = true,
  contentOf,
}: UseLibrarySelectionOptions<T>): LibrarySelection {
  const projector = useProjector();
  const [preview, setPreviewIndex] = useState<number | null>(null);
  const [navigated, setNavigated] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  /* A new list is a new selection. Landing on the first item means one ↓
     reaches the second, which is the common case. */
  useEffect(() => {
    setPreviewIndex(items.length && selectFirst ? 0 : null);
    setNavigated(false);
  }, [items, selectFirst]);

  /* Arrowing past the fold has to bring the row with it, or the selection
     moves somewhere the operator cannot see. A `point` has already put the
     row where it should be — sometimes mid smooth-scroll — so it is left be. */
  const quiet = useRef(false);
  useEffect(() => {
    if (preview === null) return;
    if (quiet.current) {
      quiet.current = false;
      return;
    }
    listRef.current
      ?.querySelector<HTMLElement>(`[data-row="${preview}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [preview]);

  /* One builder for both acts. Preview and send describing the same row
     differently is how a panel ends up showing one verse and the projector
     another. */
  const itemAt = useCallback(
    (i: number): LiveItem | null => {
      const it = items[i];
      if (!it) return null;
      return {
        source,
        id: idOf(it, i),
        label: labelOf(it, i),
        origin: 'operator',
        ...contentOf?.(it, i),
      };
    },
    [items, source, idOf, labelOf, contentOf],
  );

  const setPreview = useCallback(
    (i: number, mirror = true) => {
      setPreviewIndex(i);
      /* Staging happens whether or not this was a deliberate move: `mirror`
         is about echoing back into the field the operator is typing in, and
         showing them what they just named is not an echo. */
      const item = itemAt(i);
      if (item && contentOf) projector.stage(item);
      if (mirror && items[i]) onPreviewChange?.(items[i], i);
    },
    [items, onPreviewChange, itemAt, contentOf, projector],
  );

  const point = useCallback((i: number) => setPreviewIndex((current) => {
    /* Only a real move runs the scroll effect, so only a real move may
       silence it — otherwise the next arrow press would not scroll. */
    if (current !== i) quiet.current = true;
    return i;
  }), []);

  const navigate = useCallback(
    (delta: -1 | 1) => {
      if (!items.length) return;
      setNavigated(true);
      setPreviewIndex((i) => {
        const next = Math.min(items.length - 1, Math.max(0, (i ?? 0) + delta));
        if (items[next]) onPreviewChange?.(items[next], next);
        /* Arrowing stages too — walking a chapter with the keyboard and
           watching the preview box follow is the whole point of having one
           mid-service. */
        const item = itemAt(next);
        if (item && contentOf) projector.stage(item);
        return next;
      });
    },
    [items, onPreviewChange, itemAt, contentOf, projector],
  );

  const send = useCallback(
    (i: number) => {
      const item = itemAt(i);
      if (!item) return;
      setPreviewIndex(i);
      projector.send(item);
    },
    [itemAt, projector],
  );

  /*
   * Enter belongs to the list only once the arrows have been used. Untouched,
   * the operator is still building a reference and Enter means something to
   * the field they are typing in.
   */
  const activate = useCallback(() => {
    if (!navigated || preview === null) return false;
    send(preview);
    return true;
  }, [navigated, preview, send]);

  const isLive = useCallback(
    (i: number) => (items[i] ? projector.isLive(source, idOf(items[i], i)) : false),
    [items, projector, source, idOf],
  );

  return { preview, setPreview, point, navigated, navigate, activate, send, isLive, listRef };
}
