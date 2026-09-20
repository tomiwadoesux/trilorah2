import { Fragment, type ReactNode } from 'react';
import { cx } from '../../../ui';
import './songs.css';

/*
 * The dock — what a tab can DO, in one capsule at the foot of its panel.
 *
 * It replaces the dashed "add …" card that used to lead every grid. That
 * card explained itself well and cost a whole cell to do it, in a grid whose
 * job is to show as many songs as it can; and it only covered "add", so
 * import, quick slides and the stock/local switch had each grown a home of
 * their own somewhere else on the tab. The dock is the one place: two or
 * three icon buttons, a hairline between them, floating over the content at
 * --tri-gap from the panel's floor.
 *
 * The material is the system's own surface (.tri-surface, ash, nearly solid) under
 * a blur, so it is a dark capsule because the app's controls are dark, not
 * because somebody else's toolbar was. Buttons are --tri-control-h squares
 * at the control corner; the capsule's corner is theirs plus its padding —
 * R_outer = R_inner + gap, the rule for anything nested in anything.
 *
 * The scroller underneath must leave room: pad it by DOCK_CLEARANCE so the
 * last row of cards can be scrolled clear of the capsule.
 */

export interface DockAction {
  id: string;
  /** Shown as the tooltip and read by assistive tech. */
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  /** Lit — the search field is open, the local shelf is showing. */
  active?: boolean;
  /** Drawn but refuses, with the reason in `label`. */
  disabled?: boolean;
}

const PAD = 4;

/** Bottom padding a scroll area under a dock needs: capsule + its two gaps. */
export const DOCK_CLEARANCE = `calc(var(--tri-control-h) + ${PAD * 2}px + var(--tri-gap) * 3)`;

export function TabDock({ actions, label }: { actions: DockAction[]; label: string }) {
  return (
    /* The wrapper spans the panel and ignores the pointer, so only the
       capsule itself is ever in the way of the cards under it. */
    <div
      className="pointer-events-none absolute inset-x-0 z-20 flex justify-center"
      style={{ bottom: 'var(--tri-gap)' }}
    >
      <div
        role="toolbar"
        aria-label={label}
        className="tab-dock tri-surface tri-surface--ash pointer-events-auto flex items-center"
        style={{
          /* Nearly solid: enough to read over a bright thumbnail, with just
             enough left for the blur to say "this floats". */
          ['--tri-alpha' as string]: 0.92,
          padding: PAD,
          gap: PAD,
          borderRadius: `calc(var(--tri-radius-control) + ${PAD}px)`,
          backdropFilter: 'blur(14px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
          boxShadow:
            'inset 0 0 0 var(--tri-border) rgb(229 243 242 / 0.2), 0 12px 32px rgb(0 0 0 / 0.6)',
        }}
      >
        {actions.map((a, i) => (
          <Fragment key={a.id}>
            {i > 0 ? (
              <span aria-hidden className="h-4 w-px shrink-0 bg-[rgb(255_255_255_/_0.12)]" />
            ) : null}
            <button
              type="button"
              title={a.label}
              aria-label={a.label}
              aria-pressed={a.active === undefined ? undefined : a.active}
              aria-disabled={a.disabled || undefined}
              onClick={a.disabled ? undefined : a.onClick}
              className={cx(
                'tri-rounded-control grid place-items-center transition-colors duration-150',
                a.disabled
                  ? 'cursor-not-allowed text-[rgb(229_243_242_/_0.28)]'
                  : a.active
                    ? 'bg-[rgb(255_255_255_/_0.12)] text-[var(--tri-ink)]'
                    : 'text-[rgb(229_243_242_/_0.7)] hover:bg-[rgb(255_255_255_/_0.08)] hover:text-[var(--tri-ink)]',
              )}
              style={{ height: 'var(--tri-control-h)', width: 'calc(var(--tri-control-h) + 8px)' }}
            >
              {a.icon}
            </button>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
