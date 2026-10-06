import { popupPlacement } from '../../../lib/popupPlacement';
import { popupBounds } from '../../../ui/primitives/usePopupPlacement';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon, cx } from '../../../ui';

/*
 * A menu that opens where you pointed.
 *
 * ActionMenu hangs from its trigger and right-aligns to it, which is right
 * for a "+" and cannot be asked to open at a pointer. This is the same
 * bubble — same fill, edge, radius, row height and type, so the two read as
 * one menu system — placed at a point instead, and it drills in place the
 * way ActionMenu does, for the same reason: beside a rail pinned to the
 * window's left edge there is no room for a submenu to fly out.
 *
 * It is also the keyboard's menu. The context-menu key and Shift+F10 open
 * it from a focused row (see useContextMenu), so it takes focus when it
 * opens, moves with the arrows, and hands focus back to the row it came
 * from when it closes — otherwise a keyboard user who opens it and presses
 * Esc is dropped at the top of the document.
 */

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** The destructive row: danger ink, and a rule above it. */
  danger?: boolean;
  /** Marks the current choice in a drilled list. */
  checked?: boolean;
  /** Present = opens a list in place instead of acting. */
  items?: ContextMenuItem[];
}

export interface ContextMenuState {
  x: number;
  y: number;
  /** What to refocus on close. */
  from: HTMLElement | null;
}

/** Shared with ActionMenu by value; see the note there. */
const BUBBLE = {
  borderRadius: '14px',
  backgroundColor: 'var(--tri-pop)',
  boxShadow: '0 14px 36px rgb(0 0 0 / 0.75), inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.16)',
} as const;


const OPENED = 'tri-context-menu-opened';

/**
 * Right-click, the context-menu key and Shift+F10, as props for the row.
 * A keyboard open has no pointer, so it opens at the row's own lower-left.
 */
export function useContextMenu() {
  const [at, setAt] = useState<ContextMenuState | null>(null);
  /* Two halves, because they do not always land on the same element: a
     segment header takes the right-click on the whole strip and the keys on
     the button inside it that actually holds focus. */
  const pointer = {
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const focusable = e.currentTarget.matches('button, [tabindex]')
        ? e.currentTarget
        : e.currentTarget.querySelector<HTMLElement>('button, [tabindex]');
      setAt({ x: e.clientX, y: e.clientY, from: focusable });
    },
  };
  const keys = {
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      const asked = e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10');
      /* Only from the row itself: the same keys inside a note's text field
         belong to the field. */
      if (!asked || e.target !== e.currentTarget) return;
      e.preventDefault();
      e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect();
      setAt({ x: r.left + 12, y: r.bottom - 2, from: e.currentTarget });
    },
  };
  return { at, pointer, keys, bind: { ...pointer, ...keys }, close: () => setAt(null) };
}

export function ContextMenu({
  at,
  items,
  label,
  onSelect,
  onClose,
}: {
  at: ContextMenuState | null;
  items: ContextMenuItem[];
  label: string;
  onSelect: (item: ContextMenuItem) => void;
  onClose: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState<string[]>([]);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const parent = path.reduce<ContextMenuItem | undefined>(
    (found, id) => (found?.items ?? items).find((i) => i.id === id),
    undefined,
  );
  const list = parent?.items ?? items;

  const close = (refocus = true) => {
    const from = at?.from;
    setPath([]);
    setPos(null);
    onClose();
    if (refocus) from?.focus({ preventScroll: true });
  };

  /* Placed after it has a size, and kept inside the window: a right-click
     near the bottom of the rail must open upward rather than off-screen. */
  useLayoutEffect(() => {
    if (!at) return;
    const el = menu.current;
    if (!el) return;
    const place = () => setPos(popupPlacement({ left: at.x, right: at.x, top: at.y, bottom: at.y }, el.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight }, 'left'));
    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    window.addEventListener('resize', place);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); };
  }, [at, path.length]);

  /* Focus follows the level: first row on open and on every drill. */
  useEffect(() => {
    if (!at || !pos) return;
    menu.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, path.length, pos !== null]);

  /* One menu at a time. A pointer press elsewhere already closes this one
     (below), but a menu opened from the KEYBOARD presses nothing — so each
     menu announces itself as it opens and any other one steps down. */
  useEffect(() => {
    if (!at) return;
    const me = menu.current;
    window.dispatchEvent(new CustomEvent(OPENED, { detail: me }));
    const other = (e: Event) => {
      if ((e as CustomEvent).detail !== me) close(false);
    };
    window.addEventListener(OPENED, other);
    return () => window.removeEventListener(OPENED, other);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  useEffect(() => {
    if (!at) return;
    const away = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) close(false);
    };
    /* Capture, so a press on a control that stops propagation still closes
       it; and a second right-click elsewhere closes this one first. */
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('resize', away);
    window.addEventListener('blur', away);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('resize', away);
      window.removeEventListener('blur', away);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  if (!at) return null;

  const onKey = (e: React.KeyboardEvent) => {
    const rows = [...(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => rows[(n + rows.length) % rows.length]?.focus();
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(rows.length - 1);
    else if (e.key === 'Escape' || e.key === 'Tab') close();
    else if (e.key === 'ArrowLeft' && path.length) setPath((p) => p.slice(0, -1));
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const row =
    'flex shrink-0 w-full items-center gap-2.5 rounded-[10px] px-3.5 text-left lowercase transition-colors h-[var(--tri-option-h)] text-[length:var(--tri-control-size)] outline-none hover:bg-[rgb(255_255_255_/_0.06)] focus-visible:bg-[rgb(255_255_255_/_0.08)]';

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={label}
      onKeyDown={onKey}
      onContextMenu={(e) => e.preventDefault()}
      className="tri-ctx-in fixed z-[70] flex flex-col gap-1 p-1.5"
      style={{
        ...BUBBLE,
        ...popupBounds,
        minWidth: 'min(176px, calc(100vw - 24px))',
        left: pos?.left ?? at.x,
        top: pos?.top ?? at.y,
        /* Measured invisible for one layout pass, so it never shows at the
           unclamped position first. */
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {parent && (
        <>
          <button type="button" role="menuitem" onClick={() => setPath((p) => p.slice(0, -1))} className={cx(row, 'text-[rgb(229_243_242_/_0.62)]')}>
            <ChevronDownIcon size={11} className="shrink-0 rotate-90" />
            <span className="truncate">{parent.label}</span>
          </button>
          <span aria-hidden className="mx-1 my-0.5 h-px shrink-0 bg-[rgb(255_255_255_/_0.08)]" />
        </>
      )}
      {list.map((item) => (
        <div key={item.id} className="contents">
          {item.danger && <span aria-hidden className="mx-1 my-0.5 h-px shrink-0 bg-[rgb(255_255_255_/_0.08)]" />}
          <button
            type="button"
            role={item.checked !== undefined ? 'menuitemradio' : 'menuitem'}
            aria-checked={item.checked}
            aria-haspopup={item.items ? 'menu' : undefined}
            onClick={() => {
              if (item.items) {
                setPath((p) => [...p, item.id]);
                return;
              }
              /* Closed WITHOUT refocusing the row: what was chosen usually
                 wants focus itself — a note's field, a rename box. */
              close(false);
              onSelect(item);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' && item.items) {
                e.preventDefault();
                e.stopPropagation();
                setPath((p) => [...p, item.id]);
              }
            }}
            className={cx(row, item.danger ? 'text-[var(--tri-ink-danger)]' : 'text-[var(--tri-ink)]')}
          >
            {item.icon && (
              <span className={cx('grid w-[14px] shrink-0 place-items-center', item.danger ? '' : 'text-[rgb(143_211_192_/_0.85)]')}>
                {item.icon}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.checked && <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-[rgb(var(--tri-go-2))]" />}
            {item.items && <ChevronDownIcon size={10} className="shrink-0 -rotate-90 text-[rgb(229_243_242_/_0.4)]" />}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
