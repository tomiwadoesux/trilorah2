import { isEmptyPreview } from '../../emptyPreviewMode';
import { Panel } from '../parts';
import { HistoryIcon } from '../../../ui';
import { EmptyMark, ChartArt } from '../emptyArt';

/*
 * The last few Sundays — the one tile on the dashboard that is not about now.
 *
 * It answers a question the team asks after the service rather than during
 * it: has this been going well, or was today unusual? A single figure could
 * not say that, because the answer is a shape — four or five services read
 * down the column, where a bad week shows up as one number out of line with
 * its neighbours rather than as a number that has to be judged on its own.
 * So this is a table, and everything in it is tabular-nums: figures that do
 * not sit in the same column are four separate facts, not a trend.
 *
 * Each row is a door. The dashboard is read, not worked, and a door is the
 * one interaction that does not break that — pressing it does not change
 * anything, it opens the service you are already looking at. Nothing here
 * can reach the projector, so a mis-press costs a screen, not a service.
 *
 * The doors carry no surface of their own. Five stacked fills inside a
 * panel stop reading as rows of a table and start reading as a second list
 * of cards, so the affordance is spent where it costs nothing: a faint
 * wash marks the row and the preacher's name comes up out of muted ink.
 * That is also the only feedback a full-bleed row can take — the system's
 * press scale pulls a control in from both edges, which on a row spanning
 * the whole tile tears it away from the rules above and below it.
 *
 * The rows split the region evenly rather than standing at --tri-row-h, for
 * the reason ConnectionsTile gives: the tile is handed a box it does not
 * choose, so sharing the region means the list is always exactly as tall as
 * the tile and can neither scroll nor end in dead space. A fifth service
 * makes every row shorter rather than pushing the oldest out of sight.
 *
 * The summary line beneath is the church's own average, not this list's and
 * not one preacher's. It is where the numbers that used to sit under a
 * pastor's name belong once they are about the building: it earns its place
 * by being the thing the rows cannot say, which is what normal looks like.
 */

/** One completed service, as the history screen will hand it over. */
export interface ServiceRow {
  id: string;
  date: string;
  preacher: string;
  /** References actually put on screen, not references detected. */
  verses: number;
  /** Share of detections confirmed correct, 0–100. */
  accuracy: number;
  minutes: number;
}

/* Placeholder content standing in for the real service history. Shaped
   exactly like ServiceRow, so wiring the history store in later is a
   one-line swap for this const and nothing else in the file moves. */
const SERVICES: readonly ServiceRow[] = [
  { id: 'svc-1', date: '23 apr', preacher: 'pastor dan', verses: 14, accuracy: 92, minutes: 38 },
  { id: 'svc-2', date: '16 apr', preacher: 'pastor dan', verses: 11, accuracy: 88, minutes: 34 },
  { id: 'svc-3', date: '09 apr', preacher: 'sis. grace', verses: 9, accuracy: 74, minutes: 41 },
  { id: 'svc-4', date: '02 apr', preacher: 'pastor dan', verses: 16, accuracy: 90, minutes: 33 },
  { id: 'svc-5', date: '26 mar', preacher: 'bro. femi', verses: 7, accuracy: 81, minutes: 29 },
];

/* Church-level, deliberately: the rows already carry per-service figures,
   and repeating one preacher's averages under them would be the same claim
   twice at two different scopes. */
const SUMMARY = 'avg 35 min · most quoted romans 11:23 · psalm, romans, john';

/* Same weight and same job as ConnectionsTile's: a line separating rows
   from each other, riding on the row rather than standing between them as
   an element that would take height the rows are already dividing. */
const RULE = 'inset 0 -1px 0 rgb(255 255 255 / 0.07)';

const MUTED = 'rgb(229 243 242 / 0.45)';

/* Accuracy is the only figure here that is a judgement rather than a count,
   so it is the only one that takes a colour — and it takes the same three
   the rest of the system uses for good / watch / wrong. The thresholds are
   the auto-mode gate's own shape: at 90 the engine would be trusted to run
   itself, under 80 somebody sat correcting it all morning. */
function accuracyInk(accuracy: number): string {
  if (accuracy >= 90) return '#8fd3c0';
  if (accuracy >= 80) return '#e4d87a';
  return '#eac7c6';
}

export function RecentServicesTile({ className, onOpen }: { className?: string; onOpen?: () => void }) {
  /* A church before its first recorded service, or a fresh install. The
     column headers and the summary line go with the rows rather than
     standing over an empty region: both of them are claims about services
     that exist — "verses · accuracy · length" labels columns that aren't
     there, and the summary asserts an average drawn from nothing. */
  if (isEmptyPreview || SERVICES.length === 0) {
    return (
      <Panel title="recent services" className={className} bodyClass="pt-3">
        <EmptyMark art={<ChartArt />} line="no services yet" />
      </Panel>
    );
  }

  return (
    <Panel
      className={className}
      title="recent services"
      icon={<HistoryIcon size={13} />}
      blurb="the last few Sundays, and how each one went."
      onOpen={onOpen}
      bodyClass="pt-3"
    >
      <div className="flex h-full flex-col">
        {/* Only two words, for five columns. Naming every column would put
            more label on the tile than data; the figures say what they are
            by their own suffixes, and the pair that needs saying is which
            end of the row is the service and which is how it went. */}
        <div
          className="flex shrink-0 items-baseline justify-between gap-2 pb-1.5 text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em] text-[rgb(229_243_242_/_0.55)]"
          style={{ boxShadow: RULE }}
        >
          <span className="shrink-0">service</span>
          {/* min-w-0 + truncate rather than a shorter word: the label names
              three columns in the order they appear, and a narrow cell
              should lose the tail of that list rather than squeeze
              "service" — the word the left column is read by. */}
          <span className="min-w-0 truncate">verses · accuracy · length</span>
        </div>

        <ul className="flex min-h-0 flex-1 flex-col">
          {SERVICES.map((service, i) => (
            <li
              key={service.id}
              className="flex min-h-0 flex-1 flex-col"
              style={i < SERVICES.length - 1 ? { boxShadow: RULE } : undefined}
            >
              {/* The whole row is the door — a button inside the row would
                  make the operator aim at a word, and this tile is read at
                  arm's length or further.

                  It wears no surface, for the reason the training tile's
                  amend door wears none: five stacked resting fills inside a
                  panel read as a second list. surface() cannot be borrowed
                  for the hover alone — .tri-surface paints a gradient
                  through background-IMAGE, so a bg-transparent layered over
                  it clears the colour behind the gradient and nothing else,
                  and all five rows light at the rest alpha anyway. The
                  press scale is wrong here too: a full-bleed row shrinking
                  off both edges tears away from the rules above and below
                  it. So the feedback is the one thing a row can do without
                  moving or filling — the ink comes up. */}
              <button
                type="button"
                className="group/row flex min-h-0 w-full flex-1 items-center gap-2 rounded-[4px] px-1.5 text-left transition-colors duration-150 hover:bg-[rgb(255_255_255_/_0.04)] focus-visible:bg-[rgb(255_255_255_/_0.04)] focus-visible:outline-none"
              >
                <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                  {/* The date is the row's handle and never elides; the
                      preacher gives way first, because a clipped name is
                      still a name and a clipped date is a wrong date. */}
                  <span className="shrink-0 tabular-nums text-[length:var(--tri-size)] font-semibold text-[var(--tri-ink)]">
                    {service.date}
                  </span>
                  {/* The muted ink is a class here, not the inline MUTED the
                      rest of the tile uses: an inline colour outranks the
                      hover utility, so the lift would never land. */}
                  <span className="min-w-0 truncate text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.45)] transition-colors group-hover/row:text-[rgb(229_243_242_/_0.7)]">
                    {service.preacher}
                  </span>
                </span>

                {/* Right-aligned columns, so the three figures line up down
                    the list. Read down, 92 above 88 above 74 is a trend;
                    read ragged it is three unrelated numbers that happen to
                    share a tile.

                    The widths are in ch, not px, because ch is a measure of
                    the digits actually set — at the touch tier the type
                    goes to 11px and a px box sized for 10px crowds the
                    widest value, whereas a ch box grows with it. tabular
                    figures make ch exact rather than approximate. */}
                <span className="shrink-0 tabular-nums text-right text-[length:var(--tri-size-xs)]">
                  <span className="inline-block w-[3.5ch]" style={{ color: MUTED }}>
                    {service.verses}v
                  </span>
                  <span
                    className="inline-block w-[4.5ch] font-semibold"
                    style={{ color: accuracyInk(service.accuracy) }}
                  >
                    {service.accuracy}%
                  </span>
                  <span className="inline-block w-[6.5ch]" style={{ color: MUTED }}>
                    {service.minutes} min
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* Outside the list on purpose. It sits below the last row's missing
            rule so it reads as a footnote to the table rather than as a
            sixth service with the columns knocked out. */}
        <p
          className="shrink-0 truncate pt-2 text-[length:var(--tri-size-xs)] lowercase"
          style={{ color: MUTED }}
        >
          {SUMMARY}
        </p>
      </div>
    </Panel>
  );
}
