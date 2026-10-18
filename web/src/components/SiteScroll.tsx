'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type Lenis from 'lenis';

let siteScroller: Lenis | undefined;

/** Section buttons share the same scroll controller as ordinary anchor links. */
export function scrollToSiteSection(id: string, immediate = false) {
  const target = document.getElementById(id);
  if (!target) return;
  if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
  if (siteScroller) siteScroller.scrollTo(target, { immediate });
  else target.scrollIntoView();
}

const nativeScroll = 'dialog, .ns-dropdown-viewport, .pd-response-area, .ls-pattern-options, textarea, select, [data-lenis-prevent]';

export function SiteScroll() {
  const pathname = usePathname();

  useEffect(() => {
    // Marketing/content pages only; operator, live, mic and preview tools keep
    // their own scrolling, and never download the Lenis module.
    const enabled = ['/', '/hero', '/home', '/download', '/guide'].includes(pathname)
      || pathname.startsWith('/guide/');
    if (!enabled) return;

    let cancelled = false;
    let lenis: Lenis | undefined;
    let dialogs: MutationObserver | undefined;

    void import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({
        autoRaf: true,
        lerp: .12,
        smoothWheel: true,
        syncTouch: false,
        respectReducedMotion: true,
        anchors: true,
        stopInertiaOnNavigate: true,
        prevent: (node) => node.matches(nativeScroll),
      });
      siteScroller = lenis;

      const syncDialogs = () => {
        if (document.querySelector('dialog[open]')) lenis?.stop();
        else lenis?.start();
      };
      dialogs = new MutationObserver(syncDialogs);
      dialogs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
      syncDialogs();
    });

    return () => {
      cancelled = true;
      dialogs?.disconnect();
      if (siteScroller === lenis) siteScroller = undefined;
      lenis?.destroy();
    };
  }, [pathname]);

  return null;
}
