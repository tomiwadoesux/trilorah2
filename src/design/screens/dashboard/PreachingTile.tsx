import { cx, surface } from '../../../ui';
import { Panel } from '../parts';
import ThinkingOrbsPill from '../../orb/ThinkingOrbsPill';
import { useBoxSize } from './useBoxSize';

/*
 * PreachingTile — who is up, and the engine listening to them.
 *
 * The tallest and narrowest tile on the dashboard. From across a dark booth
 * the tech team should be able to read it without reading it: the sphere is
 * turning, so the engine is hearing something. The transcript beneath it
 * fades backwards in time rather than being labelled, so the eye lands on
 * the sentence being said right now without first working out which line is
 * the newest.
 */

/** The last three things the engine heard, oldest first. */
const HEARD: readonly [string, string, string] = [
  'back then when Jesus used to be dwelling amidst and they were saying',
  'He was a young boy living with his aunt',
  'and the Lord said He was a young boy living with his aunt',
];

const WHO = 'pastor dan preaching';

export function PreachingTile({ className }: { className?: string }) {
  const orb = useBoxSize<HTMLDivElement>();
  /* Off the SHORTER side, with a little air left round it — a portrait box
     that sized the ball off its width would push the sphere out through the
     floor of the tile. Rounded because the canvas re-reads its own box each
     frame and a fractional diameter only buys resampling. */
  const ball = Math.round(Math.min(orb.width, orb.height) * 0.86);

  return (
    <Panel className={className} bodyClass="pt-3" unavailable="needs a preacher profile selected for this service">
      <div className="flex h-full flex-col gap-[var(--tri-gap)]">
        <p className="shrink-0 truncate text-center text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.55)]">
          {WHO}
        </p>

        {/* The one region that gives: title and card keep their heights and
            the sphere takes whatever is left, which is what lets the tile
            sit in a grid cell of unknown size without ever overflowing. */}
        <div
          ref={orb.ref}
          className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        >
          {/* Nothing before the first measurement — the orb would otherwise
              mount at its own 46px default and visibly jump to size. */}
          {ball > 0 && (
            <ThinkingOrbsPill
              style="noise"
              dotColor="#e5f3f2"
              accent="#66bb6a"
              speed={1}
              dotOpacity={0.9}
              showsPill={false}
              showsLabel={false}
              scheme="dark"
              ball={ball}
              /* A MULTIPLIER on the style's own 150, not a count. The context
                 bar's orb runs at 0.6 because 150 is mush at 38px; at five
                 times that diameter the same count is a handful of specks in
                 a large circle, and the ball stops reading as a surface. 4×
                 fills the shell without reaching the 1024 ceiling. */
              dots={4}
            />
          )}
        </div>

        {/* The quiet version of the heard card: no backdrop, no badge, no
            act. Nothing here can be clicked, so it carries none of the
            weight the operator's proposal card has to. */}
        <div
          className={cx(surface({ tone: 'default', shape: 'panel', wide: true }), 'shrink-0 p-2.5')}
          style={{ borderRadius: 12 }}
        >
          <div className="flex flex-col gap-1 text-center leading-[1.375]">
            <p className="truncate text-[length:var(--tri-size-eyebrow)] text-[rgb(229_243_242_/_0.16)]">
              {HEARD[0]}
            </p>
            <p className="truncate text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.34)]">
              {HEARD[1]}
            </p>
            {/* The only line allowed to wrap, and clamped at two: the card
                is the tile's floor, so a long sentence growing it would
                take its height straight out of the sphere. */}
            <p className="line-clamp-2 text-[length:var(--tri-size)] font-semibold text-[var(--tri-ink)]">
              {HEARD[2]}
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}
