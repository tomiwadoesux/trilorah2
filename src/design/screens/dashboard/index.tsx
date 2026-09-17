import { PreachingTile } from './PreachingTile';
import { EngagementChart } from './EngagementChart';
import { ConnectedTile } from './ConnectedTile';
import { PreacherStatsTile } from './PreacherStatsTile';
import { ReadinessTile } from './ReadinessTile';
import { RecentServicesTile } from './RecentServicesTile';
import { TrustTrendTile } from './TrustTrendTile';
import { CompanionTile } from './CompanionTile';
import { VoiceCommandsTile } from './VoiceCommandsTile';
import { GivingTile } from './GivingTile';
import { TimersTile } from './TimersTile';

/*
 * S-02 · dashboard — the bento the rest of the team watches.
 *
 * The operator surface and this are the same screen in two postures. The
 * operator column is a working surface: everything on it is reached for
 * mid-service. The dashboard is not touched at all — it is read, often from
 * across the booth, by whoever is running sound or camera and wants to know
 * how the service is going without asking. So the switch in the context bar
 * does not swap a panel; it swaps the whole body, the run-of-service rail
 * included. Keeping the rail would be keeping a control column beside a
 * surface that has no controls.
 *
 * The bar itself stays, because it is the way back and because the orb and
 * the service log are the two things worth having in both postures.
 *
 * Every tile is a glance or a door. Nothing here changes what the
 * congregation sees; the moment a tile needs a control that does, it has
 * outgrown this board and belongs on the operator surface.
 *
 * One preacher, said once. The board carries a preacher in exactly two
 * places — PreachingTile, which is who is up right now, and
 * PreacherStatsTile, which is what they tend to do — and that is the
 * ceiling. A roster of preacher cards and a training queue were both here
 * and both came off: with the orb, the stats block and the two of them the
 * screen said "preacher" four times over, and a board that repeats its
 * subject reads as four answers to a question nobody asked twice. The
 * training queue in particular was the wrong surface for it — accepting
 * fourteen detections is a job with its own screen (S-02R), not something
 * to skim from across a booth.
 *
 * Four tiles OPEN. Companion, giving, voice commands and connections each
 * carry settings that used to be a page in S-10; on the board they show
 * the glance — the QR, the chips, the noticed phrases, the six rows — and
 * pressing one lifts it to the centre of the window onto the full set.
 * See ./expand. Settings stays for what a church sets once; the board
 * holds what they touch on a Sunday.
 */

/*
 * The proportions are the drawing's own pixel measurements, used as flex
 * weights rather than percentages.
 *
 * Percentages and gaps do not mix: three rows at 34.7 / 39 / 27.4 percent
 * plus two gutters is 100% of the height plus 14px, so something has to
 * give and flexbox picks. Weights on a zero basis divide what is actually
 * left after the gutters, which means the ratio the drawing sets holds at
 * every artboard — and the numbers stay readable as what they are, the
 * measurements off the file.
 */

export function DashboardBento() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[var(--tri-gap)]">
      {/* Who is preaching, and how the room is answering. The two tiles
          that carry the service itself get the top band to themselves. */}
      <div className="flex min-h-0 basis-0 grow-[312] gap-[var(--tri-gap)]">
        <PreachingTile className="basis-0 grow-[345]" />
        <EngagementChart className="basis-0 grow-[814]" />
      </div>

      {/* The middle band. Its two columns keep their own vertical rhythm —
          the left splits 105/236, the right 259/82 — so this is a band of
          two stacks rather than a row of four cells. */}
      <div className="flex min-h-0 basis-0 grow-[351] gap-[var(--tri-gap)]">
        <div className="flex min-w-0 basis-0 grow-[623] flex-col gap-[var(--tri-gap)]">
          {/* Short and wide is exactly the shape of one verdict, which is
              why readiness sits here and not in the tall cell: on a normal
              Sunday this tile is a sentence, and a sentence given a square
              spends most of it on air. It grows into the failing state by
              listing only what failed — two rows, then a count. */}
          <ReadinessTile className="basis-0 grow-[105]" />
          <div className="flex min-h-0 basis-0 grow-[236] gap-[var(--tri-gap)]">
            <VoiceCommandsTile className="basis-0 grow-[312]" />
            <ConnectedTile className="basis-0 grow-[303]" />
          </div>
        </div>
        <div className="flex min-w-0 basis-0 grow-[535] flex-col gap-[var(--tri-gap)]">
          {/* The QR wants a near-square; the giving strip is a row of chips
              and wants exactly the short cell the drawing left under it.

              Timers take their cell out of the companion's, not out of
              giving's: the QR was the one tile on the board with slack in it
              — a 148px code in a cell drawn for more — while the giving strip
              is a single row of chips that has nothing to give. A few rows of
              clock is what the leftover is worth. */}
          <CompanionTile className="basis-0 grow-[175]" />
          <TimersTile className="basis-0 grow-[84]" />
          <GivingTile className="basis-0 grow-[82]" />
        </div>
      </div>

      {/* The preacher's own band — what this one preacher tends to do, which
          is the one thing on the screen that is not about today. The trend
          and the history join it: all three are the record rather than the
          service, and they read as one band because of it. */}
      <div className="flex min-h-0 basis-0 grow-[246] gap-[var(--tri-gap)]">
        <PreacherStatsTile className="basis-0 grow-[623]" />
        <RecentServicesTile className="basis-0 grow-[258]" />
        <TrustTrendTile className="basis-0 grow-[265]" />
      </div>
    </div>
  );
}
