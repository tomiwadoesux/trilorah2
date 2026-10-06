import { usePopupPlacement, popupBounds } from './usePopupPlacement';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/cx';
import { ChevronDownIcon } from '../icons';
import { ArrangeList } from './ArrangeList';

/*
 * The menu a "+" opens.
 *
 * Two things make it its own component rather than markup in a screen.
 *
 * It drills rather than cascades. A submenu that flies out sideways has to
 * find room beside itself, and next to a rail pinned to the left edge there
 * is none — so a nested list replaces the panel in place, with a back row to
 * return. One box, one position, no matter how deep it goes.
 *
 * And it renders through a portal. Panel clips its children to its rounded
 * corners with overflow-hidden, which is right for content and fatal for a
 * menu: anchored inside, it would be cut off at the panel's edge.
 */

export interface ActionMenuItem {
  id: string;
  label: string;
  /** Leading glyph. Present on the top level, where the eye needs the target. */
  icon?: ReactNode;
  /** Present = this row opens a list instead of doing something. */
  items?: ActionMenuItem[];
  /** Carries the system gradient — for the one route that is the point. */
  accent?: boolean;
  /**
   * Its `items` are a set to be picked and put in order, not a list to pick
   * one from — see ArrangeList. The submenu becomes the thing being built
   * rather than a second column of choices.
   */
  arrange?: boolean;
}

export interface ActionMenuGroup {
  items: ActionMenuItem[];
  /**
   * How the group is drawn.
   *
   *   list   full-width rows, icon left — the default, for things that read
   *          as a sentence you pick from.
   *   tiles  icon over label, side by side, splitting the width — for a
   *          couple of peer actions where neither leads anywhere and the
   *          glyph identifies them faster than the words do.
   */
  layout?: 'list' | 'tiles';
}

export interface ActionMenuProps {
  /** The control that opens it. Wrapped, not cloned. */
  trigger: ReactNode;
  /** Each group is drawn as its own bubble. */
  groups: ActionMenuGroup[];
  onSelect?: (item: ActionMenuItem) => void;
  /** An arranged submenu was committed — the picks, in the order set. */
  onArrange?: (parent: ActionMenuItem, picked: ActionMenuItem[]) => void;
  className?: string;
}

/** Gap between the trigger and the menu it opens. */

/** Closest the menu may come to the window edge before it stops travelling. */


/** Each group is its own floating surface, so each carries the whole recipe. */
const BUBBLE = {
  borderRadius: '14px',
  backgroundColor: '#101010',
  boxShadow: '0 14px 36px rgb(0 0 0 / 0.75), inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.16)',
} as const;

export function ActionMenu({ trigger, groups, onSelect, onArrange, className = '' }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  /* Ids drilled into. Empty = the top level. */
  const [path, setPath] = useState<string[]>([]);


  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const box = usePopupPlacement(open, anchorRef, menuRef);

  /* Walk the path to whatever list is showing, and remember its parent so the
     back row can name where it came from. Drilling in collapses the groups:
     one list has nothing to be grouped against. */
  let list: ActionMenuItem[] | null = null;
  let parent: ActionMenuItem | null = null;
  for (const id of path) {
    const pool: ActionMenuItem[] = list ?? groups.flatMap((g) => g.items);
    const found: ActionMenuItem | undefined = pool.find((i) => i.id === id);
    if (!found?.items) break;
    parent = found;
    list = found.items;
  }

  /*
   * Right edges align, so the menu opens leftward.
   *
   * A "+" sits at the right end of a header, and a menu hung from its left
   * edge would run off the panel. Measured in viewport coordinates because
   * the portal escapes every containing block on the way up.
   */

  /* Closing returns it to the top level: reopening into a submenu the operator
     drilled to minutes ago would be answering a question they did not ask. */
  const close = () => {
    setOpen(false);
    setPath([]);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !anchorRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      // Back out one level before closing — Escape at depth means "up".
      if (e.key === 'Backspace' && path.length) setPath((p) => p.slice(0, -1));
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, path.length]);

  /*
   * Drilled into a set rather than a list. The whole panel changes job — it
   * is a thing being built now, not a thing being chosen from — so it gets
   * its own width, its own type size and a softer corner than the menu's.
   */
  const arranging = !!parent?.arrange;

  /*
   * The row. Deliberately the Select's own row — same height token, same
   * padding, same type size. The two menus open feet apart in the rail and
   * any difference between them reads as a mistake.
   *
   * Arranging changes one thing only: the corner, down to the 8px the set's
   * rows use, so the back row belongs to the panel it heads. Everything
   * about its scale stays the menu's, because a set is a level of the same
   * menu rather than a different surface.
   */
  const row = cx(
    'flex w-full items-center gap-2.5 px-3.5 text-left lowercase transition-colors',
    'h-[var(--tri-option-h)] text-[length:var(--tri-control-size)] text-[var(--tri-ink,#e5f3f2)]',
    arranging ? 'rounded-[8px]' : 'rounded-[10px]',
  );

  return (
    <div ref={anchorRef} className={cx('relative inline-flex', className)}>
      <span onClick={() => (open ? close() : setOpen(true))}>{trigger}</span>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[60] flex flex-col gap-[var(--tri-gap)] lowercase"
            style={{
              ...popupBounds,
              top: box?.top ?? 0,
              left: box?.left ?? 0,
              visibility: box ? 'visible' : 'hidden',
              /* Sized to the longest label rather than to a round number:
                 the top level is two short rows and a pair of tiles, and the
                 segment list underneath runs a little longer. An arranged set
                 takes that same submenu width — it carries a handle and a box
                 ahead of the label, but at the menu's own type size those fit
                 inside the width the words already needed. */
              minWidth: `min(${parent ? 190 : 168}px, calc(100vw - 24px))`,
            }}
          >
            {(parent
              ? [{ items: list ?? [], layout: 'list' as const, back: parent }]
              : groups.map((g) => ({ ...g, back: null as ActionMenuItem | null }))
            ).map((group, gi) => (
              <div
                key={gi}
                className="flex shrink-0 flex-col p-1.5 gap-1"
                /* Less corner while arranging: the rows inside sit on an 8px
                   radius, and a 14px shell around them read as a capsule
                   holding rectangles. */
                style={arranging ? { ...BUBBLE, borderRadius: '12px' } : BUBBLE}
              >
                {/* Only at depth. On the top level there is nowhere to go back
                    to, and a disabled back row would be furniture. */}
                {group.back && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPath((p) => p.slice(0, -1))}
                      className={cx(
                        row,
                        'hover:bg-[rgb(255_255_255_/_0.05)]',
                        /* The back row belongs to the panel it heads, so it
                           takes that panel's held-back ink — see the note on
                           the labels in ArrangeList. */
                        arranging
                          ? 'text-[rgb(229_243_242_/_0.58)]'
                          : 'text-[rgb(229_243_242_/_0.62)]',
                      )}
                    >
                      <ChevronDownIcon size={11} className="shrink-0 rotate-90" />
                      <span className="truncate">{group.back.label}</span>
                    </button>
                    <span
                      aria-hidden
                      className="mx-1 my-0.5 h-px shrink-0"
                      style={{ background: 'rgb(255 255 255 / 0.08)' }}
                    />
                  </>
                )}

                {arranging ? (
                  /*
                   * The set. Its own component because picking-and-ordering
                   * is a different act from choosing, and ActionMenu should
                   * not learn to do both — see ArrangeList.
                   */
                  <ArrangeList
                    options={group.items.map((i) => ({ id: i.id, label: i.label }))}
                    commitLabel="add to run"
                    onCommit={(picked) => {
                      const byId = new Map(group.items.map((i) => [i.id, i]));
                      onArrange?.(
                        parent!,
                        picked.map((p) => byId.get(p.id)!).filter(Boolean),
                      );
                      close();
                    }}
                  />
                ) : group.layout === 'tiles' ? (
                  /* Side by side, each taking half — the pair reads as one
                     control with two halves rather than two more rows. */
                  <div className="flex gap-1">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onSelect?.(item);
                          close();
                        }}
                        className={cx(
                          /* Tight: a tile is still a menu row, just stacked.
                             At full padding the pair was taller than the two
                             rows above them put together. */
                          'flex min-w-0 flex-1 flex-col items-center justify-center gap-1',
                          /* Same type as the list rows above them: a tile is
                             still a menu row, so two sizes inside one bubble
                             stack was the group contradicting itself. */
                          'rounded-[10px] py-2 text-[length:var(--tri-control-size)] lowercase',
                          'text-[var(--tri-ink,#e5f3f2)] transition-colors',
                          'hover:bg-[rgb(255_255_255_/_0.06)]',
                        )}
                      >
                        <span className="text-[rgb(143_211_192_/_0.85)]">{item.icon}</span>
                        <span className="max-w-full truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        if (item.items) setPath((p) => [...p, item.id]);
                        else {
                          onSelect?.(item);
                          close();
                        }
                      }}
                      className={cx(
                        row,
                        item.accent
                          ? 'tri-surface tri-interactive'
                          : 'hover:bg-[rgb(255_255_255_/_0.06)]',
                      )}
                    >
                      {item.icon && (
                        <span
                          className={cx(
                            'shrink-0',
                            item.accent
                              ? 'text-[rgb(229_243_242_/_0.9)]'
                              : 'text-[rgb(143_211_192_/_0.85)]',
                          )}
                        >
                          {item.icon}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.items && (
                        <ChevronDownIcon
                          size={10}
                          className="shrink-0 -rotate-90 text-[rgb(229_243_242_/_0.4)]"
                        />
                      )}
                    </button>
                  ))
                )}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
