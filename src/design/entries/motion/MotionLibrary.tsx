import { useMemo, useRef, useState } from 'react';
import { Sheet, Group, Note, Spec } from '../../Sheet';
import { MOTIONS, TENOR_NOTE, type Motion, type Tenor } from './catalogue';

/*
 * M-01 — the yui540 motion library, and where each piece could go here.
 *
 * Forty-two pure-CSS/SVG animations from github.com/yui540/css-animations
 * (MIT, © 2026 yui540), running live. The files are copied twice on
 * purpose: design/motion/yui540/ is the reference copy that ships with the
 * licence, and public/motion/yui540/ is what these iframes load.
 *
 * WHY THIS PAGE EXISTS. Not to admire them. Every one of these is a
 * candidate for a real waiting moment in this app, and the page pairs each
 * animation with the places it could live — so the question stops being
 * "is this nice" and becomes "is this the right tenor for the thing the
 * operator is waiting on". Those two are not the same question, and the
 * distinction the page is built around is the one D-30 already established:
 *
 *   LOADING  something is in flight and will finish. A progress-shaped
 *            loop is honest here.
 *   WAITING  ready and unused, nothing in flight. Must never resolve —
 *            a spinner here says work is happening when nothing is.
 *
 * Almost every empty state this app has is WAITING, and almost every
 * animation on the internet is LOADING. That mismatch is the whole reason
 * to look at these carefully rather than dropping them in.
 */

const BASE = '/motion/yui540';

/** Tenor → the chip's colours. Loading and waiting are deliberately far apart. */
const TENOR_STYLE: Record<Tenor, string> = {
  loading: 'border-[#8fd3c0]/40 text-[#8fd3c0]',
  waiting: 'border-white/25 text-neutral-400',
  event: 'border-[#e4d87a]/40 text-[#e4d87a]',
  transition: 'border-[#9db8e8]/40 text-[#9db8e8]',
};

/*
 * One demo, in an iframe.
 *
 * An iframe rather than inlining the markup: each demo is a whole document
 * with its own <style>, and yui540's CSS is written against bare element
 * selectors (`html`, `.container`) that would leak into the gallery and
 * fight Tailwind's reset. The iframe is also what makes replay possible —
 * most of these play ONCE, and re-pointing src is the only way to restart a
 * CSS animation you do not own.
 */
function Demo({ m, scale }: { m: Motion; scale: number }) {
  const [nonce, setNonce] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const svg = m.file.endsWith('.svg');

  return (
    <div className="space-y-2">
      <div
        className="relative overflow-hidden rounded-md border border-hairline bg-white"
        style={{ width: 320 * scale, height: 320 * scale }}
      >
        {svg ? (
          /*
           * The five loaders are bare .svg files a few dozen pixels across,
           * not 320 stages — an iframe would park them in the corner. <img>
           * still runs the CSS inside the file, so they animate, and here
           * they can be centred and scaled up to something you can see.
           */
          <div className="flex h-full w-full items-center justify-center">
            <img
              key={nonce}
              src={`${BASE}/${m.file.replace('source/', '')}`}
              alt={m.name}
              style={{ height: 110 * scale, width: 'auto' }}
            />
          </div>
        ) : (
          <iframe
            ref={frame}
            key={nonce}
            src={`${BASE}/${m.file.replace('source/', '')}`}
            title={m.name}
            loading="lazy"
            /* Authored on a 320 stage; scaling the FRAME rather than the
               content keeps each demo's internal maths intact. */
            style={{
              width: 320,
              height: 320,
              border: 0,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          />
        )}
        {/* Replay. The once-through ones are finished by the time you look
            at them, so this is the only way to actually see most of these. */}
        {!m.loops && (
          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            className="absolute right-1.5 bottom-1.5 rounded-full border border-black/15 bg-white/85 px-2 py-0.5 text-[10px] font-medium text-neutral-600 backdrop-blur transition-colors hover:border-black/30 hover:text-black"
          >
            replay
          </button>
        )}
      </div>
    </div>
  );
}

/** The card: the demo, what it does, how it is built, and where it could go. */
function Card({ m, scale }: { m: Motion; scale: number }) {
  return (
    <article className="flex gap-5 border-b border-hairline pb-6">
      <div className="shrink-0">
        <Demo m={m} scale={scale} />
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <header className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-mono text-[10px] tracking-widest text-neutral-400">
              {String(m.n).padStart(2, '0')}
            </span>
            <h3 className="text-[15px] font-semibold tracking-tight">{m.name}</h3>
            <span
              className={`rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-widest ${TENOR_STYLE[m.tenor]}`}
            >
              {m.tenor}
            </span>
            <span className="text-[10px] text-neutral-400">
              {m.loops ? 'loops' : `once · ${m.seconds}s`}
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-neutral-600">{m.what}</p>
        </header>

        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            How it is done
          </h4>
          <ul className="mt-1.5 space-y-1">
            {m.how.map((h) => (
              <li key={h} className="text-[12px] leading-relaxed text-neutral-500">
                <span className="text-neutral-300">— </span>
                {h}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            Where it could go here
          </h4>
          <ul className="mt-1.5 space-y-1">
            {m.fits.map((f) => (
              <li key={f} className="text-[12px] leading-relaxed text-neutral-600">
                <span className="text-neutral-300">→ </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="font-mono text-[10px] text-neutral-400">{m.file}</p>
      </div>
    </article>
  );
}

const ORDER: Tenor[] = ['loading', 'waiting', 'event', 'transition'];

export function MotionLibrary() {
  const [tenor, setTenor] = useState<Tenor | 'all'>('all');
  const [scale, setScale] = useState(0.62);

  const groups = useMemo(
    () =>
      ORDER.map((t) => ({
        tenor: t,
        items: MOTIONS.filter((m) => m.tenor === t),
      })).filter((g) => tenor === 'all' || g.tenor === tenor),
    [tenor],
  );

  const shown = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <Sheet
      id="M-01"
      title="Motion library — yui540"
      status="draft"
      summary="Forty-two pure CSS and SVG animations from yui540's public repo, running live, each paired with the places in this app it could actually go. Grouped by TENOR — what the motion claims is happening — because that is the thing that decides whether a piece fits, not how it looks."
    >
      <Group title="Filter" hint={`${shown} of ${MOTIONS.length} showing`}>
        <div className="flex flex-wrap items-center gap-2">
          {(['all', ...ORDER] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTenor(t)}
              className={`rounded-full border px-2.5 py-1 text-[11px] lowercase tracking-wide transition-colors ${
                tenor === t
                  ? 'border-ink bg-ink text-white'
                  : 'border-hairline text-neutral-500 hover:border-neutral-400 hover:text-neutral-800'
              }`}
            >
              {t}
            </button>
          ))}
          <span className="ml-3 text-[11px] text-neutral-400">size</span>
          {[0.5, 0.62, 0.8, 1].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScale(s)}
              className={`rounded-full border px-2 py-1 font-mono text-[10px] transition-colors ${
                scale === s
                  ? 'border-ink text-ink'
                  : 'border-hairline text-neutral-400 hover:border-neutral-400'
              }`}
            >
              {s}&times;
            </button>
          ))}
        </div>
      </Group>

      <Note>
        <strong>Tenor is the whole filing system.</strong> The trap with a library like this is
        picking by looks. A motion makes a CLAIM about what is happening — a progress-shaped loop
        says &ldquo;work is in flight, stand by&rdquo; — and if that claim is false the interface is
        lying, however good the easing is. Almost every empty state this app has is{' '}
        <strong>waiting</strong> (ready and unused, nothing running) while almost every animation on
        the internet is <strong>loading</strong>. That mismatch is why the pieces below are grouped
        this way and not by shape.
      </Note>

      {groups.map((g) => (
        <Group key={g.tenor} title={g.tenor} hint={TENOR_NOTE[g.tenor]}>
          <div className="space-y-6">
            {g.items.map((m) => (
              <Card key={m.n} m={m} scale={scale} />
            ))}
          </div>
        </Group>
      ))}

      <Group title="The techniques worth taking" hint="what to reuse, independent of any one demo">
        <Spec
          rows={[
            [
              'overshoot',
              'scale(0) → scale(1.2, 1.25) → scale(0.9, 0.95) → scale(1). x and y scale by DIFFERENT amounts — that inequality is what makes it elastic rather than mechanical.',
            ],
            [
              'two timelines',
              'One @keyframes block can hold two separate keyframe lists — opacity finished by 20%, transform still running to 100%. The browser merges them, so each property gets its own pacing without a second animation.',
            ],
            [
              'stagger by var',
              'Each element sets --delay through :nth-child; the animation reads var(--delay). Already how D-30 staggers its song grid and chart columns.',
            ],
            [
              'chained, no JS',
              'animation: draw 1.2s ease 0s both, clear 1.2s ease 1.3s forwards. The second waits for the first by delay alone.',
            ],
            [
              'line drawing',
              'stroke-dasharray 0 L → L L, where L is path.getTotalLength() measured once and hardcoded as --stroke-length. Erase by sliding stroke-dashoffset to -L.',
            ],
            [
              'local pivots',
              'transform-box: fill-box; transform-origin: center — makes an SVG shape rotate about ITSELF rather than the viewBox origin. D-30 was shipped with this rule dead and the chart columns scaled from the corner.',
            ],
            [
              'clip-path reveals',
              'Reveal by animating clip-path rather than resizing — nothing reflows and the shape stays intact.',
            ],
            [
              'easing',
              'Snappy transitions: cubic-bezier(0.87, 0.05, 0.02, 0.97). Soft landings: cubic-bezier(0, 0.31, 0.18, 0.99). This app has --tri-ease-out and --tri-ease-in-out already.',
            ],
          ]}
        />
      </Group>

      <Note>
        <strong>What I would take first.</strong> The <strong>equalizer bars</strong> (04) for the
        catches panel while listening — it is an audio meter and that panel is waiting on audio,
        though it needs slowing right down or it claims more urgency than the moment has. The{' '}
        <strong>scribble</strong> line-draw (23) for the sermon-notes outline writing itself, which
        D-30 already draws as dashed hairlines waiting for exactly that. And{' '}
        <strong>pop out</strong> (07) for a catch landing in the heard stack, which is the most
        frequent single event in a service and currently just appears.
      </Note>

      <Note>
        <strong>What I would not take.</strong> The confetti and floating-heart bursts (35, 36). A
        celebration over a verse reaching the wall would be the app congratulating itself during
        worship, which is the wrong register for the room. The sparkle rays (37) are quiet enough to
        survive, once, on a preacher reaching auto-ready — a thing that happens a handful of times
        ever.
      </Note>

      <Note>
        <strong>Licence.</strong> MIT, © 2026 yui540. The LICENSE file sits beside the sources in{' '}
        <code>design/motion/yui540/</code> and must stay with any copy. This is the part of
        yui540&rsquo;s work she publishes for reuse; the motions on yui540.com that are not in the
        GitHub repo are marked do-not-copy and are not here.
      </Note>
    </Sheet>
  );
}
