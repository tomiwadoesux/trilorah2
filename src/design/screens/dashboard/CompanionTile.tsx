import { useEffect, useState } from 'react';
import { cx, surface, Button, SegmentedControl } from '../../../ui';
import { Panel } from '../parts';
import { QrRollArt } from '../emptyArt';
import { Expandable } from './expand';
import { RowList, type Row } from '../settingsRows';

/*
 * The companion — the page the congregation opens by scanning.
 *
 * On the dashboard it is the QR code and the one choice that matters
 * before a service: can anyone open the link, or only phones on the
 * church's Wi-Fi. The code itself is rendered by the engine as SVG — the
 * same link the projector shows — so the tile never draws a second version
 * of it, and never draws one at all until there is a real link to encode.
 *
 * "show on live" puts the code on the projector. It asks first — once —
 * with a box to stop asking, because putting something on the screen in
 * front of the room is the one thing on this board that should never
 * happen by a slipped click.
 *
 * Pressing the tile itself opens it: the box lifts to the centre and shows
 * every companion setting. The thresholds that used to sit in an advanced
 * drawer are gone — the polls tune themselves.
 */

const ROWS: Row[] = [
  { kind: 'segment', key: 'companionShareMode', label: 'Who can open the link', blurb: 'anyone — the link works from home. wifi-only — only phones on the church network.', value: 'anyone', options: ['anyone', 'wifi-only'] },
  { kind: 'text', key: 'streamUrl', label: 'Watch the stream', blurb: 'Your livestream address. Shown as a button on the companion page when set.', value: '', placeholder: 'https://youtube.com/…' },
  { kind: 'text', key: 'qrCompanionCaption', label: 'QR caption', blurb: 'The line under the QR code on the projector.', value: "Follow along on your phone — scan to see today's verses and notes." },
  { kind: 'toggle', key: 'companionPollsEnabled', label: 'Congregation polls', blurb: 'When the app is unsure between two verses, ask the room. Their taps weigh into the choice. When to ask, and for how long, the app works out itself.', value: true },
  { kind: 'toggle', key: 'audienceTrainingEnabled', label: 'Audience training', blurb: 'Let "wrong verse" taps from the companion page feed the pastor\'s profile.', value: false },
  { kind: 'status', key: 'companionLogo', label: 'Logo on the page', blurb: 'Sent to phones for the length of a service, from this computer. Never stored anywhere else.', state: 'ok', text: 'church-logo.png · streaming' },
];

function Confirm({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  const [dontAsk, setDontAsk] = useState(false);
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgb(0_0_0_/_0.6)] p-3">
      <div className="tri-rounded-control w-full max-w-[260px] bg-[#0e1413] p-3.5" style={{ boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.1), 0 16px 40px rgb(0 0 0 / 0.5)' }}>
        <p className="text-[length:var(--tri-size)] font-semibold text-[var(--tri-ink)]">Put the QR code on the projector?</p>
        <p className="mt-1 text-[length:var(--tri-size-xs)] leading-relaxed text-[rgb(229_243_242_/_0.5)]">The congregation will see it until you clear the screen.</p>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.6)]">
          <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} className="accent-[#8fd3c0]" />
          don't ask again
        </label>
        <div className="mt-3 flex justify-end gap-2">
          <Button label="no" onClick={onNo} />
          <Button label="yes, show it" tone="gold" onClick={onYes} />
        </div>
      </div>
    </div>
  );
}

export function CompanionTile({ className, stacked = false }: { className?: string; stacked?: boolean }) {
  const [mode, setMode] = useState<'anyone' | 'wifi-only'>('anyone');
  const [confirm, setConfirm] = useState(false);
  const [live, setLive] = useState(false);

  /*
   * The real share link, read from settings rather than drawn from a slug.
   *
   * Until the church has both a public address and an account slug there is
   * no link to encode, and a QR drawn anyway would be a code that resolves
   * to nothing — worse than no code, because someone will scan it. While
   * `link` is null the tile draws no QR.
   */
  const [link, setLink] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const api = typeof window === 'undefined' ? undefined : window.api;
    if (!api) return;
    let alive = true;

    /* The engine renders the code, so the tile shows the same one the
       projector does rather than a second drawing of the same link. */
    /* Asked for at a generous size and then scaled to the card by CSS: the
       square now sizes itself off the tile's height, so a code rendered at
       the old fixed 148 would be resampled upward on a tall card. An SVG
       costs the same either way. */
    void api
      .getQrSvg?.(320)
      .then((res) => {
        if (!alive) return;
        setLink(res?.url ?? null);
        setQrSvg(res?.svg ?? null);
      })
      .catch(() => undefined);

    void api
      .getSettings?.()
      .then((s: Record<string, unknown>) => {
        if (!alive) return;
        const share = String(s?.companionShareMode ?? 'anyone');
        if (share === 'wifi-only' || share === 'anyone') setMode(share);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  /* Putting the code on the projector is the engine's job — it renders a
     real scannable PNG and broadcasts it to every output. */
  const showOnLive = async () => {
    const res = await window.api?.showQr?.();
    if (res?.success) {
      setLive(true);
      setNote(null);
    } else {
      setNote(res?.error ?? 'could not show the code');
    }
  };

  const clearFromLive = () => {
    void window.api?.clearMedia?.().catch(() => undefined);
    setLive(false);
  };

  return (
    <Expandable
      className={className}
      title="Companion"
      blurb="The page people open by scanning the QR code. What it shows and who may open it."
      size={{ w: 680, h: 600 }}
      tile={({ onOpen }) => (
        <Panel
          className="relative min-h-0 flex-1"
          bodyClass="pt-3"
          title={stacked ? 'companion' : undefined}
          tone={live ? 'live' : 'default'}
        >
          {confirm && (
            <Confirm
              onYes={() => {
                setConfirm(false);
                void showOnLive();
              }}
              onNo={() => setConfirm(false)}
            />
          )}
          {/*
            Two columns that actually line up.
            
            The code used to be a fixed 148px square beside a column that
            spread its own contents with justify-between, so the two halves
            agreed on nothing: the eyebrow floated above the code's top edge,
            the button below its bottom, and the card read as two unrelated
            things sharing a box. Now the square sizes itself off the card's
            own height and the column beside it is a plain stack — heading,
            link, then the controls pushed to the foot — so both sides start
            on one line and end on another.
          */}
          <div className={cx('flex h-full min-h-0 gap-4', stacked ? 'flex-col items-stretch' : 'items-stretch')}>
            {/* The code is the door: press it and the tile opens. The
                controls beside it act without opening anything. */}
            <button
              type="button"
              onClick={onOpen}
              title="open companion settings"
              className={cx(
                'tri-rounded-control group relative flex min-h-0 shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-white/[0.04] transition-colors hover:border-white/20',
                /* Stacked, the code takes whatever height the stack under it
                   leaves and squares itself off that — width follows height,
                   never the other way, or the controls fall off the floor. */
                stacked ? 'aspect-square min-h-0 flex-1 self-center' : 'aspect-square h-full max-h-[168px] self-center',
              )}
            >
              {/* The engine's own SVG — scannable, and the same code the
                  projector shows. Nothing is drawn without a real link: a
                  code built from a placeholder is one someone will scan, so
                  the empty state SAYS it is empty rather than leaving a hole
                  the eye reads as a failed image. */}
              {qrSvg ? (
                <span
                  className="block h-full w-full [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                /* Deliberately not a QR skeleton: a drawing faithful
                   enough to read as a code is faithful enough for a
                   congregant's phone to lock onto, hunt and fail — the
                   failed-image read this tile's comment warns about,
                   reached from the other side. The square is real and
                   drawn; the modules are absent. */
                <span className="tri-play-hover flex h-full w-full items-center justify-center p-2">
                  <QrRollArt />
                </span>
              )}
            </button>

            <div className={cx('flex min-w-0 flex-col gap-2', stacked ? 'shrink-0' : 'flex-1 justify-center')}>
              <div className="min-w-0">
                {!stacked && (
                  <p className="text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em] text-[rgb(229_243_242_/_0.55)]">
                    companion
                  </p>
                )}
                <p className="mt-1 truncate font-mono text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.7)]">
                  {link ? link.replace(/^https?:\/\//, '') : 'no link yet'}
                </p>
                {note && (
                  <p className="mt-1 text-[length:var(--tri-size-xs)] leading-relaxed text-[rgb(234_199_198_/_0.75)]">
                    {note}
                  </p>
                )}
              </div>

              {/* The two controls sit together under the link rather than
                  being pushed to the card's floor: the square is capped, so
                  the column centres against IT and a foot-anchored stack
                  would drift away from the thing it belongs to. */}
              <div className="flex flex-col gap-2 pt-1">
                <SegmentedControl
                  size="sm"
                  value={mode}
                  options={[
                    { id: 'anyone', label: 'anyone' },
                    { id: 'wifi-only', label: 'wifi only' },
                  ]}
                  onChange={(m) => setMode(m as typeof mode)}
                />
                <button
                  type="button"
                  onClick={() => (live ? clearFromLive() : setConfirm(true))}
                  className={cx(
                    surface({ tone: live ? 'gold' : 'default', shape: 'control', interactive: true }),
                    'tri-label flex min-h-[var(--tri-control-h)] items-center justify-center lowercase',
                    live ? 'text-[rgb(228_216_122_/_0.95)]' : 'text-[var(--tri-ink)]',
                  )}
                >
                  {live ? 'on the projector · clear' : 'show on live'}
                </button>
              </div>
            </div>
          </div>
        </Panel>
      )}
    >
      <RowList rows={ROWS} />
    </Expandable>
  );
}
