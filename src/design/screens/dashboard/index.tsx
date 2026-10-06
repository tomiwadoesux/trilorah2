import './dashboardBento.css';
import { BentoCell, BentoGrid } from './BentoCell';
import { Panel } from '../parts';
import { EmptyMark } from '../emptyArt';
import { Button } from '../../../ui';
import { AppearancePaletteArt } from '../AppearancePaletteArt';
import { LanguageLettersArt } from '../LanguageLettersArt';
import { PreachingTile } from './PreachingTile';
import { TimersTile } from './TimersTile';
import { ConnectedTile } from './ConnectedTile';
import { PreachersTile } from './PreachersTile';
import { ReadinessTile } from './ReadinessTile';
import { TrustTrendTile } from './TrustTrendTile';
import { CompanionTile } from './CompanionTile';
import { GivingTile } from './GivingTile';
import { NotificationsTile } from './NotificationsTile';
import { SermonNotesTile } from './SermonNotesTile';
import { useViewEnter } from '../viewEnter';
import { OutputsTile } from './OutputsTile';
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
  onViewProfile,
  onOpenSettings,
}: {
  log: HistoryEntry[];
  onLogAction?: () => void;
  /** The trust history opens the preacher's detailed profile. */
  onViewProfile?: () => void;
  onOpenSettings?: (page: 'appearance' | 'language') => void;
}) {
  /* The tiles settle in, in reading order, each time the dashboard is
     turned to — see ../viewEnter. */
  const root = useViewEnter<HTMLDivElement>();

  return (
    <div ref={root} className="dashboard-bento">
      <BentoGrid>
        <BentoCell><TimersTile className="dashboard-bento__tile dashboard-bento__timer" /></BentoCell>
        <BentoCell><PreachingTile className="dashboard-bento__tile dashboard-bento__transcript" /></BentoCell>
        <BentoCell><CompanionTile stacked className="dashboard-bento__tile dashboard-bento__companion" /></BentoCell>
        <BentoCell><GivingTile face="card" className="dashboard-bento__tile dashboard-bento__giving" /></BentoCell>
        <BentoCell><OutputsTile className="dashboard-bento__tile dashboard-bento__outputs" /></BentoCell>
        <BentoCell><div className="dashboard-bento__status">
          <ReadinessTile className="dashboard-bento__readiness" />
          <ConnectedTile className="dashboard-bento__connections" />
        </div></BentoCell>
        <BentoCell><NotificationsTile entries={log} onAction={onLogAction} className="dashboard-bento__tile dashboard-bento__notifications" /></BentoCell>
        <BentoCell><SermonNotesTile className="dashboard-bento__tile dashboard-bento__notes" /></BentoCell>
        <BentoCell><PreachersTile className="dashboard-bento__tile dashboard-bento__preachers" /></BentoCell>
        <BentoCell><Panel empty title="appearance" className="dashboard-bento__tile dashboard-bento__appearance">
          <EmptyMark w={175} h={160} plain art={<AppearancePaletteArt />} line="make it feel like your church"
            below={<Button label="change appearance" onClick={() => onOpenSettings?.('appearance')} />} />
        </Panel></BentoCell>
        <BentoCell><Panel empty title="language" className="dashboard-bento__tile dashboard-bento__language">
          <EmptyMark w={175} h={160} plain art={<LanguageLettersArt />} line="the language of your service"
            below={<Button label="choose language" onClick={() => onOpenSettings?.('language')} />} />
        </Panel></BentoCell>
        <BentoCell><TrustTrendTile onOpen={onViewProfile} className="dashboard-bento__tile dashboard-bento__trust" /></BentoCell>
      </BentoGrid>
    </div>
  );
}
