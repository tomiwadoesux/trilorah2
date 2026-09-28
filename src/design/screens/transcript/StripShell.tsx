import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../../../ui';
import '../dottedSurface.css';
import { dottedSurfaceStyles } from '../dottedSurface';

/*
 * The pill every transcript design sits in: the same frame, height, hover,
 * focus ring and live dot, so the options differ only in how the words
 * behave — which is the question being asked.
 *
 * It is a button because the whole strip opens the dashboard, where the
 * full transcript is. Anything inside must therefore be phrasing content
 * (spans, not paragraphs or other buttons).
 *
 * The live dot sits top-right, out of the text flow: inline it cost about
 * 18px of every line, and text is read from a hard LEFT margin, so a marker
 * there would push the first character off it.
 */
export function StripShell({
  live,
  onOpen,
  children,
  height = 'var(--tri-topbar-live-h)',
  padInline = '2rem',
  dot = true,
  style,
}: {
  live: boolean;
  /** The green listening dot. Off where the header's status orb already says it. */
  dot?: boolean;
  onOpen: () => void;
  children: ReactNode;
  /** The pill's height. Defaults to the two-line strip token. */
  height?: string;
  /** Left/right padding — inline so a design can change it without a class fight. */
  padInline?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        'tri-dotted-surface @container relative flex min-w-[64px] flex-1 cursor-pointer overflow-hidden rounded-[var(--tri-radius-control)]',
        'border border-white/10 backdrop-blur-md',
        'transition-colors hover:border-white/20',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tri-accent-yellow)]',
      )}
      style={{ ...dottedSurfaceStyles.transcript, height, paddingBlock: '6px', paddingInline: padInline, ...style }}
      title="live preacher transcript — click to open the dashboard, where the full transcript is"
      aria-label="Live preacher transcript. Opens the dashboard, where the full transcript is."
    >
      {dot && <span
        aria-label={live ? 'listening' : 'not listening'}
        className={cx(
          'absolute right-2.5 top-2 size-1.5 rounded-full transition-all',
          live ? 'animate-pulse bg-[#6ee7b7] shadow-[0_0_8px_#10b981]' : 'bg-white/30',
        )}
      />}
      {children}
    </button>
  );
}

/** What an empty strip says. Never sample scripture — see Ladder. */
export function emptyLine(asr: string) {
  return asr === 'listening' ? 'listening for the pulpit…' : 'transcripts appear here';
}

/*
 * The reading size the D-27 designs share, so they are compared at the
 * same size and the only difference is behaviour. One step up from the
 * shipped strip (11.5px on 15px): the owner wants to READ it as it is
 * said, and at 11.5px that is squinting. Derived from the transcript
 * leading token so it scales with density — 12/13/15px text on 17/18/20px
 * lines for compact/comfortable/touch — and the pill is two such lines
 * plus its 13px of padding.
 */
export const D27_FONT = 'calc(var(--tri-transcript-leading) - 2px)';
export const D27_LEADING = 'calc(var(--tri-transcript-leading) + 3px)';
export const D27_HEIGHT = 'calc(2 * (var(--tri-transcript-leading) + 3px) + 13px)';
