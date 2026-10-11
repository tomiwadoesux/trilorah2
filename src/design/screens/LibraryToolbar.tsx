import { Fragment } from 'react';
import { cx } from '../../ui';
import type { DockAction } from './songs/TabDock';

const PILL = 'h-[var(--tri-field-h)] tri-rounded-control border border-[rgb(229_243_242_/_0.10)] bg-[rgb(229_243_242_/_0.035)]';
const CONTROL = 'inline-flex items-center justify-center gap-2 whitespace-nowrap text-[length:var(--tri-control-size)] font-medium lowercase transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tri-ink)]';

function actionColor(action: DockAction) {
  return action.disabled
    ? 'cursor-not-allowed text-[rgb(229_243_242_/_0.35)]'
    : action.active
      ? 'bg-[rgb(229_243_242_/_0.10)] text-[var(--tri-ink)]'
      : 'text-[rgb(229_243_242_/_0.68)] hover:bg-[rgb(229_243_242_/_0.07)] hover:text-[var(--tri-ink)]';
}

/** Compact, flat library actions with the available search modes grouped together. */
export function LibraryToolbar({ label, actions, searchActions }: { label: string; actions: DockAction[]; searchActions: DockAction[] }) {
  return (
    <div role="toolbar" aria-label={label} className="flex w-full min-w-0 flex-wrap items-center gap-2">
      <div role="group" aria-label={`search ${label}`} className={cx(PILL, 'flex shrink-0 items-center gap-1 pl-3 pr-1')}
        style={{ opacity: searchActions.length > 0 && searchActions.every(action => action.disabled) ? 0.35 : 1 }}>
        <span className="mr-1 text-[length:var(--tri-control-size)] font-medium text-[rgb(229_243_242_/_0.68)]">search</span>
        {searchActions.map((action, index) => (
          <Fragment key={action.id}>
            {index > 0 ? <span aria-hidden="true" className="h-3 w-px bg-[rgb(229_243_242_/_0.16)]" /> : null}
            <button
              type="button"
              data-guide={`toolbar-${label}-${action.id}`}
              title={action.label}
              aria-label={action.label}
              aria-pressed={action.active}
              disabled={action.disabled}
              onClick={action.onClick}
              className={cx(CONTROL, 'h-6 w-7 rounded-md', actionColor(action))}
            >
              {action.icon}
            </button>
          </Fragment>
        ))}
      </div>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          data-guide={`toolbar-${label}-${action.id}`}
          title={action.label}
          aria-label={action.label}
          aria-pressed={action.active}
          disabled={action.disabled}
          onClick={action.onClick}
          className={cx(PILL, CONTROL, 'min-w-0 flex-1 px-3', actionColor(action))}
        >
          <span aria-hidden="true" className="flex shrink-0 items-center">{action.icon}</span>
          <span>{action.text}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * One action in this toolbar's material, for a toolbar that is not built
 * from LibraryToolbar — the media tab's row, which keeps its own search
 * pill and themes|media toggle. Sized to its words rather than sharing the
 * row; `textClassName` lets that row drop the words (icon and label stay)
 * when it gets narrow, because it does not wrap.
 */
export function LibraryAction({ action, textClassName, guideId }: { action: DockAction; textClassName?: string; guideId?: string }) {
  return (
    <button
      type="button"
      data-guide={guideId}
      title={action.label}
      aria-label={action.label}
      aria-pressed={action.active}
      disabled={action.disabled}
      onClick={action.onClick}
      className={cx(PILL, CONTROL, 'shrink-0 px-3', actionColor(action))}
    >
      <span aria-hidden="true" className="flex shrink-0 items-center">{action.icon}</span>
      <span className={textClassName}>{action.text}</span>
    </button>
  );
}
