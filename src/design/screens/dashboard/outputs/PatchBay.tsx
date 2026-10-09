import { cx } from '../../../../ui';
import { Panel } from '../../parts';
import { ROLE_NAME, ROLE_SHOWS, STATE_INK, STATE_WORD, MUTED, FAINT, type OutputsFace, type Screen } from './types';

/*
 * B · patch bay.
 *
 * The card as the back of a rack: the physical screens down the left, the
 * jobs down the right, and a cable between each pair. It is the picture a
 * sound person already has in their head — a display is a socket, a role
 * is what you plug into it — so nothing here has to be learned. Pressing
 * the job end of a cable re-patches it.
 *
 * The cable carries the state: lit mint while the screen is live, dimmed
 * when it is cleared or black, and drawn dashed and unlit for an output
 * with no display, which is what an unplugged cable looks like.
 */

const RULE = 'inset 0 -1px 0 rgb(255 255 255 / 0.07)';

function Row({ s, last, onRole }: { s: Screen; last: boolean; onRole?: (id: string) => void }) {
  const ink = s.windowed ? FAINT : STATE_INK[s.state];
  return (
    <li className="group/row flex min-h-0 flex-1 items-center gap-2" style={last ? undefined : { boxShadow: RULE }}>
      {/* The socket: the display. */}
      <div className="flex min-w-0 basis-0 grow-[5] items-center gap-2">
        <span
          aria-hidden
          className={cx('size-[9px] shrink-0 rounded-full', s.windowed ? 'border border-dashed border-white/30' : 'bg-white/[0.12] shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.2)]')}
        />
        <span className="min-w-0">
          <span className="block truncate text-[length:var(--tri-size-xs)] text-[var(--tri-ink)]">{s.windowed ? 'no screen' : s.display}</span>
          <span className="block truncate text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: FAINT }}>
            {s.windowed ? 'window on this laptop' : s.size ? `${s.size.w}×${s.size.h}` : '—'}
          </span>
        </span>
      </div>

      {/* The cable. */}
      <span aria-hidden className="relative h-px basis-0 grow-[3]" style={{ background: s.windowed ? 'transparent' : ink, opacity: s.state === 'live' ? 0.9 : 0.45, backgroundImage: s.windowed ? `repeating-linear-gradient(90deg, ${FAINT} 0 4px, transparent 4px 8px)` : undefined }}>
        <span className="absolute -top-[2px] left-0 size-[5px] rounded-full" style={{ background: ink }} />
        <span className="absolute -top-[2px] right-0 size-[5px] rounded-full" style={{ background: ink }} />
      </span>

      {/* The jack: the job. */}
      <button
        type="button"
        onClick={onRole ? () => onRole(s.id) : undefined}
        title="press to re-patch"
        className="flex min-w-0 basis-0 grow-[5] items-center justify-between gap-2 rounded-[4px] px-2 py-1 text-left transition-colors hover:bg-white/[0.06]"
      >
        <span className="min-w-0">
          <span className="block truncate text-[length:var(--tri-size)] font-semibold text-[var(--tri-ink)]">{ROLE_NAME[s.role]}</span>
          <span className="hidden truncate text-[length:var(--tri-size-eyebrow)] lowercase group-hover/row:block" style={{ color: MUTED }}>
            {ROLE_SHOWS[s.role]}
          </span>
        </span>
        <span className="shrink-0 text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: ink }}>
          {s.windowed ? 'unpatched' : STATE_WORD[s.state]}
        </span>
      </button>
    </li>
  );
}

export function PatchBayOutputs({ screens, onRole, onOpen, className }: OutputsFace) {
  return (
    <Panel className={className} bodyClass="pt-3">
      <div className="flex h-full flex-col" onClick={onOpen}>
        <div
          className="flex shrink-0 items-baseline justify-between pb-1.5 text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em] text-[rgb(229_243_242_/_0.55)]"
          style={{ boxShadow: RULE }}
        >
          <span>screen</span>
          <span>does</span>
        </div>
        <ul className="flex min-h-0 flex-1 flex-col">
          {screens.map((s, i) => (
            <Row key={s.id} s={s} last={i === screens.length - 1} onRole={onRole} />
          ))}
        </ul>
      </div>
    </Panel>
  );
}
