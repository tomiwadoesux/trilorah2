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
import { NotificationsTile } from './NotificationsTile';
import { SermonNotesTile } from './SermonNotesTile';
import { useViewEnter } from '../viewEnter';
import type { HistoryEntry } from '../LogHistory';

/*
 * S-02 · dashboard — the bento the rest of the team watches.
 *
 * The operator surface and this are the same screen in two postures. The
 * operator column is a working surface: everything on it is reached for
 * mid-service. The dashboard is not touched at all — it is read, often from
 * across the booth, by whoever is running sound or camera and wants to know
 * how the service is going without asking.
 *
 * The arrangement is S-03's (design/screens/DashboardProto): the tab nav is
 * gone, so the grid is the whole dashboard. The log is a card in it now
 * rather than a column beside it, which is why this takes the entries.
 */

export function DashboardBento({
  log,
  onLogAction,
}: {
  log: HistoryEntry[];
  onLogAction?: () => void;
}) {
  /* The tiles settle in, in reading order, each time the dashboard is
     turned to — see ../viewEnter. */
  const root = useViewEnter<HTMLDivElement>();
  return (
    <div ref={root} className="flex min-h-0 flex-1 flex-col gap-[var(--tri-gap)]">
      {/* Band 1 — what the booth looks up at: how long is left, what is
          being said, the code on the wall, and the ways to give. The
          companion is a square, with the code on top and everything under
          it; giving takes the room that frees up. */}
      <div className="flex min-h-0 basis-0 grow-[300] gap-[var(--tri-gap)]">
        <TimersTile className="basis-0 grow-[330]" />
        <PreachingTile className="basis-0 grow-[400]" />
        <CompanionTile stacked className="aspect-square shrink-0" />
        <GivingTile face="card" className="min-w-0 basis-0 grow-[330]" />
      </div>

      {/* Band 2 — the working cards. Readiness over voice commands and
          connections; the log and the notes beside them. */}
      <div className="flex min-h-0 basis-0 grow-[330] gap-[var(--tri-gap)]">
        <div className="flex min-w-0 basis-0 grow-[640] flex-col gap-[var(--tri-gap)]">
          <ReadinessTile className="min-h-0 basis-0 grow-[110]" />
          <div className="flex min-h-0 basis-0 grow-[220] gap-[var(--tri-gap)]">
            <VoiceCommandsTile className="basis-0 grow-[1]" />
            <ConnectedTile className="basis-0 grow-[1]" />
          </div>
        </div>
        <NotificationsTile entries={log} onAction={onLogAction} className="min-w-0 basis-0 grow-[300]" />
        <SermonNotesTile className="min-w-0 basis-0 grow-[300]" />
      </div>

      {/* Band 3 — the preacher: stats, recent services, and the trust trend. */}
      <div className="flex min-h-0 basis-0 grow-[246] gap-[var(--tri-gap)]">
        <PreacherStatsTile className="basis-0 grow-[623]" />
        <RecentServicesTile className="basis-0 grow-[258]" />
        <TrustTrendTile className="basis-0 grow-[265]" />
      </div>
    </div>
  );
}
