import { ShowcaseRow, ShowcaseShot } from '../ShowcaseRow';
import './service-row.css';

export function ServiceRow() {
  return (
    <ShowcaseRow
      id="service"
      title="Your whole service."
      subtitle="In running order."
      lead="Songs, scripture, pictures and slides sit in one run of show, in the order the service runs."
      detail="Pull pictures from your media library as you build it."
      features={['Run of show', 'Scan or paste a printed programme', 'Media library', 'Portable .tri service files']}
      learnMore={{ href: '/guide/run.build-edit', label: 'Build an order of service' }}
      caption="A sample service in the actual schedule dialog: open the song library, add Amazing Grace’s second verse, then move the Images section earlier. The enlarged running order stays in place."
      back={<ShowcaseShot src="/showcase/service-schedule.jpg" width={1920} height={963} />}
      front={<ShowcaseShot src="/showcase/service-schedule.jpg" width={1920} height={963} />}
    />
  );
}
