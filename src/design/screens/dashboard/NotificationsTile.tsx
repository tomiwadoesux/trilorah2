import { Panel } from '../parts';
import { HistoryIcon } from '../../../ui';
import { Expandable } from './expand';
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
    <Expandable
      className={className}
      title="Notifications"
      glyph={false}
      blurb="Everything the app has done this service, newest first."
      size={{ w: 640, h: 680 }}
      /* The card shows the last few; the box shows the service. Same list
         either way — see LogHistory — because a log that reformats itself
         when it grows is a log you have to re-learn at the moment you most
         need to read it quickly. */
      tile={({ onOpen }) => (
        <Panel
          title="notifications"
          icon={<HistoryIcon size={13} />}
          blurb="what the app has done, newest first."
          onOpen={onOpen}
          className="min-h-0 w-full flex-1"
          bodyClass="px-2 pb-2"
        >
          <LogHistory entries={entries} onAction={onAction} className="h-full" />
        </Panel>
      )}
    >
      <LogHistory entries={entries} onAction={onAction} className="h-full" />
    </Expandable>
  );
}
