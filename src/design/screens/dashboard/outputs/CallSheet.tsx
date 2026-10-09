import { cx } from '../../../../ui';
import { Panel, Dot } from '../../parts';
import { ROLE_NAME, ROLE_AUDIENCE, STATE_INK, STATE_TONE, STATE_WORD, MUTED, FAINT, type OutputsFace, type Role } from './types';

/*
 * C · call sheet.
 *
 * No drawing. Type does the work: each screen is one line that reads as a
 * sentence — "projector, for the congregation, on the Epson, live" — the
 * job in the app's own ink and everything else a step behind it. It is the
 * sheet taped to the desk on a Sunday, and it is the densest of the three:
 * six screens fit where the floor plan holds four.
 *
 * The role is a segmented control that only appears on the hovered line,
 * so at rest the card is a list and only under the hand is it a setting.
 */

const ROLES: Role[] = ['projector', 'stream', 'stage', 'timer'];
const RULE = 'inset 0 -1px 0 rgb(255 255 255 / 0.07)';

export function CallSheetOutputs({ screens, onRole, onOpen, className }: OutputsFace) {
  const live = screens.filter((s) => s.state === 'live' && !s.windowed).length;
  return (
    <Panel
      title="outputs"
      className={className}
      right={
        <span className="text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: MUTED }}>
          <span className="tabular-nums">{live}</span> of <span className="tabular-nums">{screens.length}</span> live
        </span>
      }
    >
      <ul className="flex h-full min-h-0 flex-col" onClick={onOpen}>
        {screens.map((s, i) => (
          <li
            key={s.id}
            className="group/row flex min-h-0 flex-1 items-center gap-3"
            style={i < screens.length - 1 ? { boxShadow: RULE } : undefined}
          >
            <Dot tone={s.windowed ? 'warn' : STATE_TONE[s.state]} />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2 truncate">
                <span className="text-[length:var(--tri-size)] font-semibold text-[var(--tri-ink)]">{ROLE_NAME[s.role]}</span>
                <span className="truncate text-[length:var(--tri-size-xs)] lowercase" style={{ color: MUTED }}>
                  for {ROLE_AUDIENCE[s.role]}
                </span>
              </p>
              <p className="truncate text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: s.windowed ? '#e4d87a' : FAINT }}>
                {s.windowed ? 'no screen of its own — a window on this laptop' : `on the ${s.display}`}
              </p>
            </div>

            {/* At rest: the state word. Under the hand: the four jobs. */}
            <span className="shrink-0 text-[length:var(--tri-size-xs)] lowercase group-hover/row:hidden" style={{ color: s.windowed ? FAINT : STATE_INK[s.state] }}>
              {s.windowed ? 'windowed' : STATE_WORD[s.state]}
            </span>
            <span className="hidden shrink-0 gap-px rounded-[4px] bg-white/[0.05] p-px group-hover/row:flex">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRole?.(s.id, r);
                  }}
                  className={cx(
                    'rounded-[4px] px-1.5 py-px text-[length:var(--tri-size-eyebrow)] lowercase transition-colors',
                    r === s.role ? 'bg-white/[0.12] text-[var(--tri-ink)]' : 'text-[rgb(229_243_242_/_0.45)] hover:text-[var(--tri-ink)]',
                  )}
                >
                  {r}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
