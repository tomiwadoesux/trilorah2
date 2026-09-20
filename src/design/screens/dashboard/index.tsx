import { PreachingTile } from './PreachingTile';
import { TimersTile } from './TimersTile';
import { ConnectedTile } from './ConnectedTile';
import { PreacherStatsTile } from './PreacherStatsTile';
import { ReadinessTile } from './ReadinessTile';
import { RecentServicesTile } from './RecentServicesTile';
import { TrustTrendTile } from './TrustTrendTile';
import { CompanionTile } from './CompanionTile';
import { VoiceCommandsTile } from './VoiceCommandsTile';
import { GivingTile } from './GivingTile';
import { useViewEnter } from '../viewEnter';

/*
 * S-02 · dashboard — the bento the rest of the team watches.
 *
 * The operator surface and this are the same screen in two postures. The
 * operator column is a working surface: everything on it is reached for
 * mid-service. The dashboard is not touched at all — it is read, often from
 * across the booth, by whoever is running sound or camera and wants to know
 * how the service is going without asking.
 */

export function DashboardBento() {
  /* The tiles settle in, in reading order, each time the dashboard is
     turned to — see ../viewEnter. */
  const root = useViewEnter<HTMLDivElement>();
  return (
    <div ref={root} className="flex min-h-0 flex-1 flex-col gap-[var(--tri-gap)]">
      {/* Top band: the transcript, the service timer, and the QR the room
          scans. The three things a booth looks up at — what is being said,
          how long is left, and the code on the projector — now sit on one
          line instead of the QR being buried two bands down. */}
      <div className="flex min-h-0 basis-0 grow-[312] gap-[var(--tri-gap)]">
        <PreachingTile className="basis-0 grow-[345]" />
        <TimersTile className="basis-0 grow-[407]" />
        <CompanionTile className="basis-0 grow-[407]" />
      </div>

      {/* The middle band. Its two columns keep their own vertical rhythm —
          the left splits 105/236, the right 259/82 — so this is a band of
          two stacks rather than a row of four cells. */}
      {/* With the QR gone up to the first row this band is one wide stack:
          readiness across the top, then the three working cards side by side.
          Giving keeps its own short height — a strip of payment chips
          stretched to a full band would be mostly empty card — and sits
          above them rather than leaving a column-sized hole. */}
      <div className="flex min-h-0 basis-0 grow-[351] flex-col gap-[var(--tri-gap)]">
        <div className="flex shrink-0 gap-[var(--tri-gap)]">
          <ReadinessTile className="min-w-0 basis-0 grow-[623]" />
          <GivingTile className="h-[var(--tri-bar-h)] basis-0 grow-[535] shrink-0" />
        </div>
        <div className="flex min-h-0 flex-1 gap-[var(--tri-gap)]">
          <VoiceCommandsTile className="basis-0 grow-[312]" />
          <ConnectedTile className="basis-0 grow-[303]" />
        </div>
      </div>

      {/* The preacher's own band: stats, recent services, and the trust trend */}
      <div className="flex min-h-0 basis-0 grow-[246] gap-[var(--tri-gap)]">
        <PreacherStatsTile className="basis-0 grow-[623]" />
        <RecentServicesTile className="basis-0 grow-[258]" />
        <TrustTrendTile className="basis-0 grow-[265]" />
      </div>
    </div>
  );
}
