import { Panel } from '../parts';
import { Expandable } from './expand';
import { LogHistory, type HistoryEntry } from '../LogHistory';
import { useState } from 'react';
import { useNotificationStore } from '../../../stores/notificationStore';
import { NotificationCards } from '../../../components/NotificationCenter';

/*
 * The service log, as a card in the bento rather than a column off to the
 * right of it. Same list, same cards — see LogHistory — inside the same
 * Panel every other tile has, so the grid is the whole dashboard.
 */
export function NotificationsTile({
  entries,
  onAction,
  className,
}: {
  entries: HistoryEntry[];
  onAction?: () => void;
  className?: string;
}) {
  const notifications = useNotificationStore(s => s.entries);
  const active = notifications.filter(n => n.status === 'active' && !n.dismissed).sort((a, b) => b.updatedAt - a.updatedAt);
  const [showLog, setShowLog] = useState(false);
  return (
    <Expandable
      className={className}
      title="Notifications"
      glyph={false}
      blurb="Important updates, actions, and the service log."
      size={{ w: 640, h: 680 }}
      /* The card shows the last few; the box shows the service. Same list
         either way — see LogHistory — because a log that reformats itself
         when it grows is a log you have to re-learn at the moment you most
         need to read it quickly. */
      tile={({ onOpen }) => (
        <Panel
          title="notifications"
          empty={active.length === 0}
          onOpen={onOpen}
          className="min-h-0 w-full flex-1"
          bodyClass="px-2 pb-2"
        >
          <div className="h-full overflow-y-auto">
            {active.length ? <NotificationCards entries={active.slice(0, 4)} /> : <p className="tri-notification-empty">No issues need your attention.</p>}
          </div>
        </Panel>
      )}
    >
      <div className="tri-notification-tabs">
        <button type="button" aria-pressed={!showLog} onClick={() => setShowLog(false)}>notifications</button>
        <button type="button" aria-pressed={showLog} onClick={() => setShowLog(true)}>service log</button>
      </div>
      {showLog ? <LogHistory entries={entries} onAction={onAction} className="h-full" /> : <div className="overflow-y-auto"><NotificationCards entries={[...notifications].sort((a, b) => b.updatedAt - a.updatedAt)} />{!notifications.length && <p className="tri-notification-empty">Important service events will stay here.</p>}</div>}
    </Expandable>
  );
}
