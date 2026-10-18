import { ShowcaseRow, ShowcaseShot } from '../ShowcaseRow';
import './congregation-row.css';

export function CompanionRow() {
  return <ShowcaseRow id="congregation" anchorId="companion" demo={false}
    title="Follow the message." subtitle="Take a little of it home."
    lead="The congregation opens a church link to read along, explore scripture and keep their own notes."
    detail="Read passages in the World English Bible, revisit published services and download what you want to keep. Personal notes and saved verses stay on that device."
    features={['Word-by-word reading', 'Bible passages and full chapters', 'Personal notes and saved verses', 'Published transcript history and downloads']}
    learnMore={{ href: '/live/preview', label: 'Try the congregation preview' }}
    caption="Companion preview with sample service content. The congregation reader on a phone, alongside its tablet and laptop layout. The paired operator remote is a separate tool."
    back={<ShowcaseShot src="/showcase/congregation-tablet.png" width={1280} height={900}/>}
    front={<ShowcaseShot src="/showcase/congregation-scriptures.png" width={390} height={844}/>}
  />;
}
