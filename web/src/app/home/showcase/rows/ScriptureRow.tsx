import { ShowcaseRow, ShowcaseShot } from '../ShowcaseRow';
import './scripture-row.css';

/*
 * Row 1, the reference row. Both panels are native captures from the real app
 * (scripts/capture-showcase.mjs). The story follows the owner's rule: the
 * transcript catches Psalm 46:10, the workspace holds it in preview beside
 * go live, and the wall still shows Psalm 46:2 until someone presses.
 *
 * Features, checked in the app's code:
 * - Live scripture recognition: electron/engine/referenceResolver.ts + scriptureSession.ts, fed by the ASR loop in electron/main.ts
 * - Quotes and allusions: electron/engine/quoteMatcher.ts (getQuoteMatcher in main.ts) and
 *   electron/engine/allusionFinder.ts (suggestAllusion in main.ts; its models ship via electron-builder.yml)
 * - Preview before it goes live: autoMode.decide(..., { manualOnly: true }) in main.ts; VerseDelivery.promote in electron/engine/verseDelivery.ts
 * - Voice commands like "next verse": electron/engine/voiceCommands.ts (onNavigate -> session.advance in main.ts)
 */
export function ScriptureRow() {
  return (
    <ShowcaseRow
      id="scripture"
      title="Say the verse."
      subtitle="It’s ready to show."
      lead="Trilorah listens along with the preacher."
      detail="When a reference or a quote is spoken, the verse waits in preview, and it goes on the wall when you press go live."
      features={['Live scripture recognition', 'Quotes and allusions', 'Preview before it goes live', 'Voice commands like “next verse”']}
      learnMore={{ href: '/guide/bible.lookup-preview-reference', label: 'Find and preview a passage' }}
      caption="The preacher transcript catches Psalm 46:10 as it is spoken. Behind it, the operator’s workspace holds Psalm 46:10 in preview beside the go live button, while Psalm 46:2 stays on the wall."
      back={<ShowcaseShot src="/showcase/verse-workspace.webp" width={2570} height={1766} />}
      front={<ShowcaseShot src="/showcase/verse-transcript.webp" width={900} height={1069} />}
    />
  );
}
