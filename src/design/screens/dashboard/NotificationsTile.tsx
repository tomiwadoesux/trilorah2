import { Panel } from '../parts';
import { LogHistory, type HistoryEntry } from '../LogHistory';

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
  return (
    <Panel title="notifications" className={className} bodyClass="px-2 pb-2">
      <LogHistory entries={entries} onAction={onAction} className="h-full" />
    </Panel>
  );
}
