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
      {/* Top band: Preacher Transcript Tile and Engagement Chart */}
      <div className="flex min-h-0 basis-0 grow-[312] gap-[var(--tri-gap)]">
        <PreachingTile className="basis-0 grow-[345]" />
        <EngagementChart className="basis-0 grow-[814]" />
      </div>

      {/* The middle band. Its two columns keep their own vertical rhythm —
          the left splits 105/236, the right 259/82 — so this is a band of
          two stacks rather than a row of four cells. */}
      <div className="flex min-h-0 basis-0 grow-[351] gap-[var(--tri-gap)]">
        <div className="flex min-w-0 basis-0 grow-[623] flex-col gap-[var(--tri-gap)]">
          <ReadinessTile className="basis-0 grow-[105]" />
          <div className="flex min-h-0 basis-0 grow-[236] gap-[var(--tri-gap)]">
            <VoiceCommandsTile className="basis-0 grow-[312]" />
            <ConnectedTile className="basis-0 grow-[303]" />
          </div>
        </div>
        <div className="flex min-w-0 basis-0 grow-[535] flex-col gap-[var(--tri-gap)]">
          <CompanionTile className="basis-0 grow-[259]" />
          <GivingTile className="basis-0 grow-[82]" />
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
