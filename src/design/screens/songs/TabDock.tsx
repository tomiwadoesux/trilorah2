import { Fragment, type ReactNode } from 'react';
import { cx } from '../../../ui';
import './songs.css';

/*
 * Full-width library actions with equal sections and centered icon/text pairs.
 * Modest corners and a quiet border keep the toolbar distinct from cards.
 */

export interface DockAction {
  id: string;
  /** Details shown in the tooltip and accessible description. */
  label: string;
  text: string;
  icon: ReactNode;
  onClick?: () => void;
  /** Lit — the search field is open, the local shelf is showing. */
  active?: boolean;
  /** Drawn but refuses, with the reason in `label`. */
  disabled?: boolean;
}

const PAD = 4;

export function TabDock({ actions, label }: { actions: DockAction[]; label: string }) {
  return (
    <div className="flex w-full min-w-0 shrink-0 justify-center">
      <div
        role="toolbar"
        aria-label={label}
        className="tab-dock tri-surface tri-surface--ash pointer-events-auto flex w-full min-w-0 items-center"
        style={{
          ['--tri-alpha' as string]: 0.92,
          padding: PAD,
          gap: PAD,
          borderRadius: 6,
          boxShadow:
            'inset 0 0 0 var(--tri-border) rgb(229 243 242 / 0.12), 0 2px 6px rgb(0 0 0 / 0.16)',
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
              aria-label={a.text}
              aria-description={a.label}
              aria-pressed={a.active === undefined ? undefined : a.active}
              aria-disabled={a.disabled || undefined}
              onClick={a.disabled ? undefined : a.onClick}
              className={cx(
                'grid min-w-0 flex-1 place-items-center rounded-md px-3 text-[length:var(--tri-control-size)] font-medium lowercase transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--tri-ink)]',
                a.disabled
                  ? 'cursor-not-allowed text-[rgb(229_243_242_/_0.38)]'
                  : a.active
                    ? 'bg-[rgb(255_255_255_/_0.12)] text-[var(--tri-ink)]'
                    : 'text-[rgb(229_243_242_/_0.75)] hover:bg-[rgb(255_255_255_/_0.08)] hover:text-[var(--tri-ink)]',
              )}
              style={{ minHeight: 'max(32px, var(--tri-control-h))' }}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <span aria-hidden="true" className="flex shrink-0 items-center">{a.icon}</span>
                <span>{a.text}</span>
              </span>
            </button>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
