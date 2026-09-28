import { Panel } from '../parts';
import { BalanceArt, EmptyMark } from '../emptyArt';
import { PreachingTile } from './PreachingTile';
import { TimersTile } from './TimersTile';
import { ConnectedTile } from './ConnectedTile';
import { PreachersTile } from './PreachersTile';
import { ReadinessTile } from './ReadinessTile';
import { RecentServicesTile } from './RecentServicesTile';
import { TrustTrendTile } from './TrustTrendTile';
import { CompanionTile } from './CompanionTile';
import { GivingTile } from './GivingTile';
import { NotificationsTile } from './NotificationsTile';
import { SermonNotesTile } from './SermonNotesTile';
import { useViewEnter } from '../viewEnter';
import { OutputsTile } from './OutputsTile';
import type { HistoryEntry } from '../LogHistory';
import { useEffect, useRef, useState } from 'react';

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
  onViewProfile,
}: {
  log: HistoryEntry[];
  onLogAction?: () => void;
  /* Both of the band-3 summary cards are about a preacher's record, and
     the whole of that record is the profile view. They open there rather
     than into a box of their own: a second, deeper copy of "recent
     services" would be the same table twice, in two places, drifting. */
  onViewProfile?: () => void;
}) {
  /* The tiles settle in, in reading order, each time the dashboard is
     turned to — see ../viewEnter. */
  const root = useViewEnter<HTMLDivElement>();

  /* The held card below matches the timers card's width, so the gap
     between them runs straight down through both bands. Ratios alone
     cannot do it: the companion square makes band 1's widths depend on
     its height. */
  const timersCell = useRef<HTMLDivElement>(null);
  const [timersW, setTimersW] = useState<number | null>(null);
  useEffect(() => {
    const el = timersCell.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTimersW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={root} className="flex min-h-0 flex-1 flex-col gap-[var(--tri-gap)] [&_section.tri-rounded-surface]:bg-[#111111]">
      {/* Band 1 — what the booth looks up at: how long is left, what is
          being said, the code on the wall, and the ways to give. The
          companion is a square, with the code on top and everything under
          it; giving takes the room that frees up. */}
      <div className="flex min-h-0 basis-0 grow-[300] gap-[var(--tri-gap)]">
        <div ref={timersCell} className="flex min-w-0 basis-0 grow-[330]">
          <TimersTile className="min-w-0 flex-1" />
        </div>
        <PreachingTile className="basis-0 grow-[400]" />
        <CompanionTile stacked className="aspect-square shrink-0" />
        <GivingTile face="card" className="min-w-0 basis-0 grow-[330]" />
      </div>

      {/* Band 2 — the working cards: a held card, readiness over
          connections, then the log and the notes. */}
      <div className="flex min-h-0 basis-0 grow-[330] gap-[var(--tri-gap)]">
        {/* The outputs card down the left — which screens are plugged in
            and what each one does. Readiness over connections on the
            right. */}
        <div className="flex min-w-0 basis-0 grow-[520] gap-[var(--tri-gap)]">
          <div
            className={timersW == null ? 'flex min-w-0 basis-0 grow-[1]' : 'flex shrink-0'}
            style={timersW == null ? undefined : { width: timersW }}
          >
            <OutputsTile className="flex-1" />
          </div>
          <div className="flex min-w-0 basis-0 grow-[1] flex-col gap-[var(--tri-gap)]">
            <ReadinessTile className="min-h-0 basis-0 grow-[150]" />
            <ConnectedTile className="min-h-0 basis-0 grow-[200]" />
          </div>
        </div>
        <NotificationsTile entries={log} onAction={onLogAction} className="min-w-0 basis-0 grow-[300]" />
        <SermonNotesTile className="min-w-0 basis-0 grow-[420]" />
      </div>

      {/* Band 3 — the preachers (who is on today, everyone the app knows,
          and each one's profile behind a press), recent services, and the
          trust trend. */}
      <div className="flex min-h-0 basis-0 grow-[246] gap-[var(--tri-gap)]">
        {/* The preachers card keeps the left half of what the old two-card
            split occupied. Beside it, a card held open on purpose: a bare
            gap in the band reads as a layout that broke, where an empty
            card reads as a place kept. It says what it is waiting for, so
            it is a promise rather than a hole. */}
        <PreachersTile className="basis-0 grow-[340]" />
        {/* A word in the header rather than a blank band: a card whose
            header is empty where every sibling has one is the thing that
            reads as a render that stopped halfway. "kept" makes the
            emptiness a decision someone took. */}
        <Panel title="kept" className="basis-0 grow-[283]" bodyClass="px-4 pb-3">
          <EmptyMark w={170} h={170} plain art={<BalanceArt />} play="hover" line="room kept for what comes next" />
        </Panel>
        <RecentServicesTile onOpen={onViewProfile} className="basis-0 grow-[258]" />
        <TrustTrendTile onOpen={onViewProfile} className="basis-0 grow-[265]" />
      </div>
    </div>
  );
}
