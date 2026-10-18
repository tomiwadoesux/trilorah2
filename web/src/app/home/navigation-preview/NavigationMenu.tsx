'use client';

import { useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from '@/components/icons';
import { NavigationMedia, type NavigationMediaKind } from './NavigationMedia';
import valley from '../../../../../src/assets/backgrounds/valley.jpg';
import companionNotes from '../assets/companion-notes.png';
import './navigation-study.css';

// The Product / Resources dropdown, shared by the navigation study and the home page.

export type Menu = 'product' | 'resources';
export type Destination = { id?: string; title: string; description: string; sections: string[] };
export type Tile = Destination & { id: string; media: NavigationMediaKind; large?: boolean; disabled?: boolean };

export const blog: Tile = { id: 'blog', title: 'Blog', description: 'Ideas, stories, and a closer look at Trilorah.', media: 'blog', sections: ['Stories from Trilorah', 'Product explainers', 'Ideas for your service team'] };
export const blogStories = [
  { id: 'story-service', title: 'A service that moves with you.', description: 'Songs, scripture, and screens. One place for the whole service.', sections: ['Bring the service together', 'Prepare songs and media', 'Follow the live message'], image: valley, kind: 'service' },
  { id: 'story-companion', title: 'A thought worth taking home.', description: 'Keep verses and sermon notes close, in everyone’s hands.', sections: ['Join with a QR code', 'Follow the words and verses', 'Keep a thought from the message'], image: companionNotes, kind: 'companion' },
];
export const product: Tile[] = [
  { id: 'branding', title: 'Branding', description: 'Your church. Your colors. Your own look.', media: 'branding', sections: ['Your church name and logo', 'App colors and display themes', 'Scripture fonts and text layouts', 'Backgrounds for your screens'] },
  { id: 'scripture', title: 'Live scripture', description: 'Follow the message. Find the right words.', media: 'scripture', sections: ['Scripture recognition', 'Translations and corrections', 'From the spoken word to the screen'] },
  { id: 'companion', title: 'Congregation companion', description: 'One service. Everyone following along.', media: 'companion', sections: ['Join with a QR code', 'Live verses and transcript', 'Sermon notes on your phone'] },
  { id: 'presentation', title: 'Presentations & services', description: 'Songs, scripture, and screens. Ready for Sunday.', media: 'presentation', sections: ['The presentation workspace', 'Preparing a running order', 'Songs, media, and slide layouts', 'Portable service files'] },
];
export const resources: Tile[] = [
  { id: 'guides', title: 'Guides', description: 'A little guidance, from setup to Sunday.', media: 'guides', large: true, sections: ['Getting started', 'Preparing your first service', 'Setting up your screens', 'Connecting the congregation'] },
  { id: 'issues', title: 'Reported issues', description: 'See reported problems, their status, and what’s been fixed.', media: 'updates', disabled: true, sections: [] },
  blog,
  { id: 'updates', title: 'What’s new', description: 'The latest improvements, big and small.', media: 'updates', sections: ['Product updates', 'New features', 'Fixes and improvements'] },
];
const cardSlots = [
  { id: 'feature', product: product[0], resources: resources[0] },
  { id: 'story', product: product[1], resources: resources[2] },
  { id: 'updates', product: product[2], resources: resources[3] },
  { id: 'aside', product: product[3], resources: resources[1] },
];
export const walkthrough: Destination = { title: 'How it works', description: 'From preparation to the final amen.', sections: ['Prepare the service', 'Present and follow the message', 'Bring the congregation along'] };
export const about: Destination = { title: 'About Trilorah', description: 'Made for the message. And the people behind it.', sections: ['Why Trilorah exists', 'Who we’re building for', 'The people behind Trilorah', 'Get in touch'] };

export function BlogCards({ current, mobile = false, onOpen }: { current: boolean; mobile?: boolean; onOpen: (page: Destination) => void }) {
  return <section className={`ns-blog-group${mobile ? ' ns-blog-mobile' : ''}`} aria-label="Blog">
    {mobile && <button type="button" className="ns-blog-heading" tabIndex={current ? 0 : -1} onClick={() => onOpen(blog)}>Blog<ArrowRight size={13} /></button>}
    <div className="ns-blog-stories">{blogStories.map((story) => <button type="button" key={story.kind} className={`ns-blog-story ns-blog-story-${story.kind}`} tabIndex={current ? 0 : -1} onClick={() => onOpen(story)}>
      <span className="ns-blog-story-media" aria-hidden="true">{story.kind === 'companion' ? <span className="ns-blog-screen"><Image src={story.image} alt="" fill sizes="190px" draggable={false} /></span> : <Image src={story.image} alt="" fill sizes="190px" draggable={false} />}</span>
      <span className="ns-blog-story-copy"><small className="ns-blog-story-label">Blog<ArrowRight size={9} aria-hidden="true" /></small><strong>{story.title}</strong>{!mobile && <span className="ns-blog-story-desc">{story.description}</span>}</span>
      <ArrowRight className="ns-blog-story-arrow" size={12} aria-hidden="true" />
    </button>)}</div>
  </section>;
}

type DropdownProps = {
  active: Menu | null;
  layoutMenu: Menu;
  onOpen: (page: Destination) => void;
  onPanelKey: (event: KeyboardEvent<HTMLDivElement>, menu: Menu) => void;
  demoHref: string;
  onDemo?: () => void;
};

/** One bento whose cards morph between the Product and Resources layouts. */
export function NavigationDropdown({ active, layoutMenu, onOpen, onPanelKey, demoHref, onDemo }: DropdownProps) {
  const visible = active !== null;
  // Opening from closed shows the hovered menu at once; only switching while open morphs the cards.
  const [fresh, setFresh] = useState(true);
  const [wasVisible, setWasVisible] = useState(visible);
  const [lastMenu, setLastMenu] = useState(layoutMenu);
  if (visible !== wasVisible) { setWasVisible(visible); if (visible) setFresh(true); }
  if (layoutMenu !== lastMenu) { setLastMenu(layoutMenu); if (visible && wasVisible) setFresh(false); }

  return <div className="ns-dropdown" data-open={visible} data-menu={layoutMenu} data-fresh={fresh}>
    <div className="ns-dropdown-viewport"><div id="ns-navigation-panel" className="ns-dropdown-content" aria-hidden={!visible} onKeyDown={(event) => { if (active) onPanelKey(event, active); }}>
      <div className="ns-bento" aria-label={`${layoutMenu === 'product' ? 'Product' : 'Resources'} card layout`}>
        {cardSlots.map((slot) => <div key={slot.id} className="ns-bento-card" data-card-slot={slot.id}>
          {(['product', 'resources'] as Menu[]).map((menu) => {
            const current = active === menu;
            const tile = slot[menu];
            return <div key={menu} className={`ns-panel ns-panel-${menu}`} data-active={current} aria-hidden={!current}>
              {tile.id === 'blog' ? <BlogCards current={current} onOpen={onOpen} /> : <button type="button" className={`ns-tile ns-tile-${tile.id}${tile.large ? ' ns-tile-large' : ''}`} tabIndex={current && !tile.disabled ? 0 : -1} disabled={tile.disabled} onClick={tile.disabled ? undefined : () => onOpen(tile)}>
                {!tile.disabled && <NavigationMedia kind={tile.media} />}
                <div className="ns-tile-copy">{tile.disabled && <small className="ns-coming-soon">Coming soon</small>}<span>{tile.title}</span></div>
                {!tile.disabled && <ArrowRight className="ns-tile-arrow" size={14} aria-hidden="true" />}
              </button>}
            </div>;
          })}
        </div>)}
      </div>
      <div className="ns-utility-slot"><div className="ns-utility">
        <Link href={demoHref} className="ns-demo-link" tabIndex={visible ? 0 : -1} onClick={onDemo}><span>Watch Trilorah run through a service</span><ArrowRight size={14} aria-hidden="true" /></Link>
      </div></div>
    </div></div>
  </div>;
}
