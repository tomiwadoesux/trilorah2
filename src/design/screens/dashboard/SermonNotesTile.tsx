import { Panel } from '../parts';
import { Button } from '../../../ui';

/*
 * Sermon notes — the one card the old tab nav had that the bento did not.
 *
 * The outline the engine builds while the sermon is preached, and the two
 * things to do with it when the service ends. The engine's notes surface
 * (src/screens/Notes.tsx) is not wired into the design engine yet, so this
 * face says what it will show rather than pretending to show it; the
 * buttons are the doors, and they are not open.
 */
const MUTED = 'rgb(229 243 242 / 0.45)';

export function SermonNotesTile({ className }: { className?: string }) {
  return (
    <Panel title="sermon notes" className={className} bodyClass="pt-1">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <p className="min-h-0 flex-1 text-[length:var(--tri-size-xs)] leading-relaxed" style={{ color: MUTED }}>
          the engine outlines the sermon as it is preached — points, scriptures, quotes — and it lands here.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button label="generate" disabled className="flex-1" />
          <Button label="export" disabled className="flex-1" />
        </div>
      </div>
    </Panel>
  );
}
