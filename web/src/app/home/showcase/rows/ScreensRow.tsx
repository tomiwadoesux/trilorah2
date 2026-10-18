import { ShowcaseRow, ShowcaseShot } from '../ShowcaseRow';
import './screens-row.css';

export function ScreensRow() {
  return (
    <ShowcaseRow
      id="screens"
      title="One service."
      subtitle="Every screen its own job."
      lead="Point each screen at what it should show."
      detail="The wall gets the verse over your picture, the stage display gives the preacher the clock and what’s next, and the stream gets a clean lower third."
      features={['Projector, stage, stream and timer', 'Each one on the display you choose', 'Stage display with clock and up next', 'Clean lower third for OBS and vMix']}
      learnMore={{ href: '/guide/outputs.assign', label: 'Assign outputs to displays' }}
      caption="The native Outputs settings show the projector, stream, stage and timer roles. The demo opens the stage display picker, turns that output off, then assigns it to Dell P2419H. The actual outputs card sits behind the settings."
      back={<ShowcaseShot src="/showcase/outputs-tile.webp" width={1179} height={957} />}
      front={<ShowcaseShot src="/showcase/outputs-tile.webp" width={1179} height={957} />}
    />
  );
}