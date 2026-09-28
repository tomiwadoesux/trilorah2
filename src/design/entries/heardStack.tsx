import { useState } from 'react';
import {
  cx,
  surface,
  slideBackdrop,
  BACKDROP_BY_CONTENT,
  CloseIcon,
  MicIcon,
  Button,
} from '../../ui';
import { Sheet, Group, Note, Spec } from '../Sheet';

/*
 * S-02 — what happens when the engine hears more than one reference.
 *
 * A proposal sheet, not a built component. The Live surface today holds a
 * single `HEARD` object and one <DetectedScripture/> pinned to the panel
 * floor; there is no answer for a second catch. This lays the three
 * candidate answers side by side at the panel's true width so the choice
 * can be made by looking rather than by arguing.
 *
 * Everything here is drawn with the system's own recipe — surface(),
 * slideBackdrop(), the same type sizes and the same gold act — so what is
 * being judged is the arrangement, not a new visual language.
 */

/* The left panel is ~300px at the 1400 artboard, minus its px-3 body. The
   specimens are pinned to that so the cards are read at the width the
   operator actually gets, not at whatever the sheet is wide. */
const PANEL_W = 276;

interface Heard {
  id: string;
  ref: string;
  version: string;
  text: string;
  trust: number;
  /** Which backdrop the projector would put behind it. */
  backdrop: number;
}

/* Three catches from one stretch of preaching — the realistic case. A
   preacher builds to John 3:16 through Romans and Ephesians, and says all
   three inside a minute. Trust falls as the engine gets less certain: the
   newest catch is not automatically the surest one, which is exactly why
   the operator is still in the loop. */
const CATCHES: Heard[] = [
  { id: 'jn', ref: 'John 3:16', version: 'kjv', trust: 0.84, backdrop: 5,
    text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
  { id: 'ro', ref: 'Romans 8:28', version: 'kjv', trust: 0.71, backdrop: 2,
    text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.' },
  { id: 'ep', ref: 'Ephesians 2:8', version: 'kjv', trust: 0.62, backdrop: 8,
    text: 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God.' },
];

const EDGE = { boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.055)' } as const;

/* ------------------------------------------------------------------ */
/* The expanded card — the shipping DetectedScripture, parameterised.  */
/* ------------------------------------------------------------------ */

function ExpandedCard({ heard, stacked = false }: { heard: Heard; stacked?: boolean }) {
  return (
    <div
      className={cx(
        surface({ tone: 'indigo', shape: 'panel', wide: true }),
        'relative isolate overflow-hidden p-3',
      )}
      style={{ borderRadius: 12 }}
    >
      <img
        aria-hidden
        src={slideBackdrop(heard.backdrop, BACKDROP_BY_CONTENT.scripture)}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(to top, rgb(0 0 0 / 0.58) 0%, rgb(0 0 0 / 0.34) 55%, rgb(0 0 0 / 0.26) 100%)',
          boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.12)',
          borderRadius: 12,
        }}
      />

      <div className="flex items-baseline gap-1.5">
        <span
          aria-hidden
          className="size-[5px] shrink-0 self-center rounded-full bg-[#8fd3c0]"
          style={{ animation: 'tri-heard-pulse 2.2s var(--tri-ease-soft) infinite' }}
        />
        <span className="text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em] text-[rgb(229_243_242_/_0.45)]">
          heard
        </span>
        <span className="text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.14em] tabular-nums text-[rgb(143_211_192_/_0.9)]">
          {Math.round(heard.trust * 100)}%
          <span className="ml-1 font-normal text-[rgb(229_243_242_/_0.4)]">sure</span>
        </span>
        {/* Only when there is a stack: which of how many this is. Without a
            stack the count is noise — there is nothing to be 1 of. */}
        {stacked && (
          <span className="ml-auto flex items-baseline gap-2 text-[length:var(--tri-size-eyebrow)] uppercase tracking-[0.14em] text-[rgb(229_243_242_/_0.35)]">
            {heard.version}
          </span>
        )}
        {!stacked && (
          <span className="ml-auto text-[length:var(--tri-size-eyebrow)] uppercase tracking-[0.14em] text-[rgb(229_243_242_/_0.35)]">
            {heard.version}
          </span>
        )}
      </div>

      <p
        className="mt-1.5 text-[var(--tri-ink)]"
        style={{
          fontFamily: 'var(--font-scripture)',
          fontWeight: 'var(--font-scripture-weight)' as never,
          fontSize: 17,
          lineHeight: 1.25,
        }}
      >
        {heard.ref}
      </p>

      <p
        className="mt-1 overflow-hidden text-[rgb(229_243_242_/_0.6)]"
        style={{
          fontFamily: 'var(--font-scripture)',
          fontWeight: 'var(--font-scripture-weight)' as never,
          fontSize: 12,
          lineHeight: 1.55,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {heard.text}
      </p>

      <div className="mt-2.5 flex items-center gap-1.5">
        <span className="h-[2px] min-w-0 flex-1 overflow-hidden rounded-full bg-[rgb(255_255_255_/_0.08)]">
          <span
            className="block h-full rounded-full bg-[rgb(143_211_192_/_0.55)]"
            style={{ width: `${heard.trust * 100}%` }}
          />
        </span>
      </div>

      <div className="mt-2 flex items-stretch gap-[var(--tri-gap)]">
        <button
          type="button"
          className={cx(
            surface({ tone: 'ash', interactive: true }),
            'flex shrink-0 items-center justify-center text-[rgb(229_243_242_/_0.5)]',
          )}
          style={{ borderRadius: 8, width: 28 }}
        >
          <CloseIcon size={12} />
        </button>
        <button
          type="button"
          className={cx(
            surface({ tone: 'gold', shape: 'control', interactive: true }),
            'tri-label flex min-h-[var(--tri-control-h)] min-w-0 flex-1',
            'items-center justify-center gap-[6px] whitespace-nowrap lowercase',
            'px-[var(--tri-control-pad-x)] text-[rgb(228_216_122_/_0.95)]',
          )}
          style={{ borderRadius: 8 }}
        >
          go live
          <span
            aria-hidden
            className="grid h-[15px] min-w-[15px] place-items-center rounded-[4px] px-[3px] text-[9px] leading-none text-[rgb(228_216_122_/_0.7)]"
            style={{ boxShadow: 'inset 0 0 0 1px rgb(228 216 122 / 0.25)' }}
          >
            ↵
          </span>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The collapsed row — one waiting catch, 26px tall                    */
/* ------------------------------------------------------------------ */

/*
 * What a waiting catch costs: one line. Reference in scripture's face so
 * it is legible as scripture at a glance, the percentage in mint so the
 * trust story is unbroken down the stack, and a 2px mint tick at the left
 * standing in for the meter the expanded card draws in full.
 *
 * No gold. A collapsed row cannot reach the congregation — clicking it
 * promotes it to the expanded card, and the gold act is always the one
 * card at the bottom. That is what keeps "one gold act" true with three
 * proposals on screen.
 */
function CollapsedRow({ heard, onPromote }: { heard: Heard; onPromote?: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onPromote}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${heard.ref} — click to bring forward`}
      className={cx(
        surface({ tone: 'ash', interactive: true }),
        'flex w-full items-center gap-2 overflow-hidden px-2 text-left',
      )}
      style={{ borderRadius: 8, height: 26 }}
    >
      {/* The meter, as a tick. Same mint, same proportion, one dimension. */}
      <span
        aria-hidden
        className="h-[10px] w-[2px] shrink-0 overflow-hidden rounded-full bg-[rgb(255_255_255_/_0.1)]"
      >
        <span
          className="block w-full rounded-full bg-[rgb(143_211_192_/_0.55)]"
          style={{ height: `${heard.trust * 100}%`, marginTop: `${(1 - heard.trust) * 100}%` }}
        />
      </span>
      <span
        className="min-w-0 flex-1 truncate text-[rgb(229_243_242_/_0.78)]"
        style={{
          fontFamily: 'var(--font-scripture)',
          fontWeight: 'var(--font-scripture-weight)' as never,
          fontSize: 12,
        }}
      >
        {heard.ref}
      </span>
      <span className="shrink-0 text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.12em] tabular-nums text-[rgb(143_211_192_/_0.72)]">
        {Math.round(heard.trust * 100)}%
      </span>
      {/* The row's own refusal, revealed on approach — a waiting catch the
          operator knows is wrong should die without being promoted first. */}
      <span
        aria-hidden
        className={cx(
          'grid size-[14px] shrink-0 place-items-center rounded-[4px] transition-opacity',
          hover ? 'opacity-100' : 'opacity-0',
        )}
        style={{ boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.14)' }}
      >
        <CloseIcon size={8} className="text-[rgb(229_243_242_/_0.6)]" />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Specimen frame — the left panel's floor, at true width              */
/* ------------------------------------------------------------------ */

/*
 * The card never floats. It lands on the floor of a panel whose ceiling is
 * the mic box, so every specimen is shown inside that panel — otherwise
 * the question "does a third row shove the on-switch" cannot be answered
 * by looking, which is the whole point of the sheet.
 */
function PanelFrame({ children, height = 300 }: { children: React.ReactNode; height?: number }) {
  return (
    <div
      className="flex flex-col justify-between gap-[var(--tri-gap)] rounded-[10px] p-3"
      style={{ width: PANEL_W, height, background: 'rgb(255 255 255 / 0.018)', ...EDGE }}
    >
      <div
        className="tri-rounded-control flex aspect-[3/2] w-full shrink-0 items-start p-2"
        style={EDGE}
      >
        <Button label="start listening for service" icon={<MicIcon size={13} />} className="w-full" />
      </div>
      <div className="flex flex-col gap-[6px]">{children}</div>
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 max-w-[276px] text-[11px] leading-relaxed text-neutral-500">{children}</div>
  );
}

function Col({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] tracking-wide text-neutral-400">{label}</div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Option A — newest expanded, older collapsed beneath                 */
/* ------------------------------------------------------------------ */

function OptionA() {
  return (
    <div className="flex flex-wrap gap-8">
      <Col label="1 detection — unchanged">
        <PanelFrame>
          <ExpandedCard heard={CATCHES[0]} />
        </PanelFrame>
        <Caption>
          One catch is the card exactly as it ships today. Nothing about the stack shows
          until there is a stack.
        </Caption>
      </Col>

      <Col label="2 detections">
        <PanelFrame>
          <CollapsedRow heard={CATCHES[1]} />
          <ExpandedCard heard={CATCHES[0]} stacked />
        </PanelFrame>
        <Caption>
          The newest catch keeps the card and the gold. The earlier one drops to a 26px
          row above it — still readable, still one click from the front, and it cost the
          mic box nothing.
        </Caption>
      </Col>

      <Col label="3 detections — the cap">
        <PanelFrame>
          <CollapsedRow heard={CATCHES[2]} />
          <CollapsedRow heard={CATCHES[1]} />
          <ExpandedCard heard={CATCHES[0]} stacked />
        </PanelFrame>
        <Caption>
          Three is the ceiling. A fourth catch pushes the oldest row out — a proposal that
          has stood through three newer ones is stale, and a scrolling list of scripture
          is not something anyone reads mid-sermon.
        </Caption>
      </Col>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Option B — oldest first, queue order                                */
/* ------------------------------------------------------------------ */

function OptionB() {
  return (
    <div className="flex flex-wrap gap-8">
      <Col label="3 detections — sermon order">
        <PanelFrame>
          <CollapsedRow heard={CATCHES[0]} />
          <CollapsedRow heard={CATCHES[1]} />
          <ExpandedCard heard={CATCHES[2]} stacked />
        </PanelFrame>
        <Caption>
          The same stack, ordered by when the preacher said it: Ephesians was said last
          and holds the card. True to the sermon's flow — but the verse the preacher is
          on <em>right now</em> is John 3:16 at the top, collapsed, and the gold act is
          pointing at the oldest thing in the stack.
        </Caption>
      </Col>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Option C — one card, overflow to the queue                          */
/* ------------------------------------------------------------------ */

function OptionC() {
  return (
    <div className="flex flex-wrap gap-8">
      <Col label="3 detections — only one shown">
        <PanelFrame>
          <div className="flex items-center justify-between px-0.5 pb-0.5">
            <span className="text-[length:var(--tri-size-eyebrow)] uppercase tracking-[0.14em] text-[rgb(229_243_242_/_0.35)]">
              2 more in queue
            </span>
          </div>
          <ExpandedCard heard={CATCHES[0]} />
        </PanelFrame>
        <Caption>
          The calmest panel of the three, and the most dangerous: two catches the operator
          never saw are now somewhere else on the screen. The trust meter exists so the
          engine never decides silently — this lets it.
        </Caption>
      </Col>
    </div>
  );
}

export function HeardStack() {
  return (
    <Sheet
      id="S-02d+"
      title="Multiple detections"
      status="draft"
      summary="What the proposal card does when the engine hears two or three references before the operator has acted on the first. Three candidate answers at the panel's true width — a decision sheet, not a built component."
    >
      <Note>
        <strong>The gap.</strong> Live holds one <code>HEARD</code> object and one{' '}
        <code>&lt;DetectedScripture/&gt;</code> pinned to the panel floor. A second catch today
        would either overwrite the first or overflow the panel. Nothing below is wired to the
        engine yet — the point is to choose the arrangement first.
      </Note>

      <Group title="Option A — newest expanded, older collapsed" hint="recommended">
        <OptionA />
      </Group>

      <Group title="Option B — oldest expanded, sermon order">
        <OptionB />
      </Group>

      <Group title="Option C — one card, overflow to the queue">
        <OptionC />
      </Group>

      <Group title="What the collapsed row costs">
        <Spec
          rows={[
            ['row height', '26px — the expanded card is ~150px, so two rows add a third of one card'],
            ['what it keeps', 'reference in scripture face, trust as a figure, trust as a vertical tick'],
            ['what it drops', 'the verse text, the backdrop, the horizontal meter, the gold act'],
            ['why no gold', 'a collapsed row cannot reach the congregation. Click promotes it to the card; the card is the only thing that goes live — which is what keeps “one gold act” true with three proposals up'],
            ['↵', 'always the expanded card, never a focused row. The keyboard hand should not have to look'],
            ['ageing', 'a row that has stood ~20s without action fades out on its own — the preacher has moved past it'],
            ['cap', '3. The 4th catch drops the oldest row'],
          ]}
        />
      </Group>

      <Note>
        <strong>What this decision drags with it.</strong> This is the first place Live holds a{' '}
        <em>list</em> of engine proposals rather than one, so two things need answering next:
        does ✕ on the card dismiss just that catch or the whole stack, and is the trust meter
        per-catch (as drawn) or one per-preacher figure the whole stack shares.
      </Note>
    </Sheet>
  );
}
