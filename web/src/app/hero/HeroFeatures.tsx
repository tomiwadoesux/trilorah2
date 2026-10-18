import type { ReactNode } from 'react';
import { BookOpen, Check, Copy, Download, Headphones, QrCode, Radio, StickyNote } from '@/components/icons';

/**
 * Placeholder artwork: marks a slot's size until the real drawing replaces it.
 * The label is the slot's size in the 1440px design; slots that bleed past a card stretch with it.
 */
function DummyArt({ width, height, className }: { width: number; height: number; className: string }) {
  return (
    <svg className={`hero-dummy-art ${className}`} width={width} height={height} fill="none" aria-hidden="true">
      <line x1="0" y1="0" x2="100%" y2="100%" stroke="currentColor" strokeOpacity=".4" />
      <line x1="100%" y1="0" x2="0" y2="100%" stroke="currentColor" strokeOpacity=".4" />
      <rect className="hero-dummy-label-ground" x="50%" y="50%" width="68" height="20" rx="3" transform="translate(-34 -10)" />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle">{width} × {height}</text>
    </svg>
  );
}

const figures = [
  { title: 'Made for Sunday', body: 'Shaped by the rhythm of real services, from the first song to the final amen.' },
  { title: 'Listens along', body: 'Hears each verse as it is preached, then waits for your press to show it.' },
  { title: 'Built to stay calm', body: 'Fewer clicks and fewer surprises, so the whole team can stay in the moment.' },
];

function HeroFigures() {
  return (
    <section className="hero-figures" aria-labelledby="hero-figures-heading">
      <div className="hero-container">
        <h2 id="hero-figures-heading">
          A calmer way to run Sunday. <span>Built for the people behind the screens, Trilorah listens along with the sermon and keeps every screen in step with the message.</span>
        </h2>
        <div className="hero-figures-grid">
          {figures.map((figure, index) => (
            <article key={figure.title} className="hero-figure">
              <span className="hero-figure-label">FIG 0.{index + 1}</span>
              <div className="hero-figure-art"><DummyArt width={240} height={240} className="hero-figure-dummy" /></div>
              <h3>{figure.title}</h3>
              <p>{figure.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BentoCard({ className, icon, title, children }: { className: string; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <article className={`hero-bento-card ${className}`}>
      <h3>{icon}{title}</h3>
      {children}
    </article>
  );
}

function HeroBento() {
  return (
    <section className="hero-bento" aria-label="What Trilorah does">
      <div className="hero-container hero-bento-grid">
        <BentoCard className="hero-bento-scripture" icon={<BookOpen size={18} />} title="Live scripture">
          <p>Every sermon is followed by <strong>a listener that knows the Bible</strong>, from Genesis to Revelation.</p>
          <ul className="hero-bento-checks">
            <li><Check size={15} />Every major translation</li>
            <li><Check size={15} />Hears references and allusions</li>
            <li><Check size={15} />Waits for your press</li>
          </ul>
          <DummyArt width={168} height={168} className="hero-bento-art" />
        </BentoCard>
        <BentoCard className="hero-bento-companion" icon={<QrCode size={18} />} title="Congregation companion">
          <p><strong>Verses, transcript and notes,</strong> on every phone in the room from a single QR code.</p>
          <DummyArt width={300} height={195} className="hero-bento-art" />
        </BentoCard>
        <BentoCard className="hero-bento-songs" icon={<Headphones size={18} />} title="Songs and lyrics">
          <p>Find any song’s words <strong>and have them ready for the screen.</strong></p>
          <span className="hero-bento-chip"><span aria-hidden="true">›</span> search lyrics <em>amazing grace</em></span>
          <DummyArt width={300} height={200} className="hero-bento-art" />
        </BentoCard>
        <BentoCard className="hero-bento-run" icon={<Copy size={18} />} title="Run of service">
          <p><strong>Build the order,</strong> scan a printed programme, or paste it in.</p>
          <DummyArt width={300} height={210} className="hero-bento-art" />
        </BentoCard>
        <BentoCard className="hero-bento-screens" icon={<Radio size={18} />} title="Every screen">
          <p><strong>Send the right thing to each screen</strong> in the room, in real time.</p>
          <DummyArt width={300} height={260} className="hero-bento-art" />
        </BentoCard>
        <BentoCard className="hero-bento-recap" icon={<StickyNote size={18} />} title="Sermon recap">
          <p>Notes and <strong>key points written</strong> as the <strong>message unfolds</strong>.</p>
          <DummyArt width={170} height={150} className="hero-bento-art" />
          <ul className="hero-bento-list">
            <li><QrCode size={18} />Sent to every phone</li>
            <li><Download size={18} />Saved for the preacher</li>
          </ul>
        </BentoCard>
        <BentoCard className="hero-bento-import" icon={<Download size={18} />} title="Bring your library">
          <p>Import services from <strong>the app you use today</strong>.</p>
          <DummyArt width={290} height={200} className="hero-bento-art" />
        </BentoCard>
      </div>
    </section>
  );
}

/** Two feature sections that follow the landscape. Artwork is placeholder until drawn. */
export function HeroFeatures() {
  return (
    <div className="hero-features">
      <HeroFigures />
      <HeroBento />
    </div>
  );
}
