import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight } from '@/components/icons';
import { ShowcaseStage } from './ShowcaseStage';
import './showcase.css';
import { FeatureDemo } from './demos/FeatureDemo';
import type { DemoId } from './demos/timelines';

export type ShowcaseRowProps = {
  /** Section id and anchor, e.g. "scripture". The section also gets the class `sc-row-<id>` for row CSS. */
  id: string;
  anchorId?: string;
  demo?: DemoId | false;
  /** Headline, first line (ink). */
  title: string;
  /** Headline, second line (grey). */
  subtitle: string;
  /** First sentence of the paragraph, in ink. */
  lead: string;
  /** The rest of the paragraph, muted. */
  detail?: string;
  /** Up to four short features, each verified in the app's code. */
  features: string[];
  /** Only for a page that exists, e.g. a /guide/<task> lesson. */
  learnMore?: { href: string; label?: string };
  /** What the composition shows, for screen readers (the screenshots inside get alt=""). */
  caption: string;
  /** The bigger screen at the back: dimmed, fading to the page on the right and bottom. */
  back?: ReactNode;
  /** The crisp panel in front, overlapping the back panel's left part. */
  front?: ReactNode;
};

/**
 * One row of the product showcase: a two-line headline, a paragraph with a
 * features list, and a stage holding a back panel and a front panel.
 * Placement, scale and look are CSS (showcase.css defaults, overridden per row
 * on `.sc-row-<id>`), so a row only fills `back` and `front`.
 */
export function ShowcaseRow({ id, anchorId = id, demo = id as DemoId, title, subtitle, lead, detail, features, learnMore, caption, back, front }: ShowcaseRowProps) {
  const headingId = `${id}-heading`;
  const featuresId = `${id}-features`;
  return (
    <section className={`sc-row sc-row-${id}`} id={anchorId} aria-labelledby={headingId}>
      <div className="home-container">
        <header className="sc-header">
          <h2 id={headingId}>{title}<br /><span>{subtitle}</span></h2>
          <div className="sc-copy">
            <p className="sc-paragraph"><span className="sc-lead">{lead}</span>{detail ? <> {detail}</> : null}</p>
            {features.length > 0 && <>
              <p className="sc-features-label" id={featuresId}>Features</p>
              <ul className="sc-features" aria-labelledby={featuresId}>{features.map(feature => <li key={feature}>{feature}</li>)}</ul>
            </>}
            {learnMore && <Link href={learnMore.href} className="home-text-link sc-learn-more">{learnMore.label ?? 'Learn more'} <ArrowRight size={16} /></Link>}
          </div>
        </header>
        <ShowcaseStage caption={caption}>
          {demo ? <FeatureDemo id={demo} fallback={<>
            {back ? <div className="sc-back">{back}</div> : null}
            {front ? <div className="sc-front">{front}</div> : null}
          </>} /> : <>{back ? <div className="sc-back">{back}</div> : null}{front ? <div className="sc-front">{front}</div> : null}</>}
        </ShowcaseStage>
      </div>
    </section>
  );
}

/**
 * A native capture from web/public/showcase, drawn pixel-exact (no optimizer
 * recompressing UI text). width/height are the file's pixels; only the ratio
 * matters, CSS sets the size.
 */
export function ShowcaseShot({ src, width, height, className, style, priority }: { src: string; width: number; height: number; className?: string; style?: CSSProperties; priority?: boolean }) {
  return <Image className={className ? `sc-shot ${className}` : 'sc-shot'} src={src} width={width} height={height} alt="" unoptimized draggable={false} priority={priority} style={style} />;
}
