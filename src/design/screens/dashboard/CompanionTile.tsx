import { useEffect, useMemo, useState } from 'react';
import { cx, surface, Button, SegmentedControl } from '../../../ui';
import { fnv1a, avatarFor } from '../../../../shared/avatar';
import { Panel } from '../parts';
import { Expandable } from './expand';
import { RowList, type Row } from '../settingsRows';

/*
 * The companion — the page the congregation opens by scanning.
 *
 * On the dashboard it is the QR code and the one choice that matters
 * before a service: can anyone open the link, or only phones on the
 * church's Wi-Fi. The church logo sits in the code's centre, streamed from
 * this computer the same way it reaches phones; if there is no logo, or it
 * could not load, the centre falls back to the church's generated mark
 * rather than to an empty square.
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

const CHURCH = 'Victory Royale Church';

/*
 * A stand-in for the real code. Deterministic from the slug so it is the
 * same picture every render, with the three finder squares a QR is
 * recognised by — the point is that the tile reads as "a QR code" at booth
 * distance, not that a phone can scan a mock.
 */
function PseudoQr({ seed, size, logo }: { seed: string; size: number; logo: string | null }) {
  const N = 25;
  const cells = useMemo(() => {
    const out: boolean[] = [];
    let h = fnv1a(seed);
    for (let i = 0; i < N * N; i += 1) {
      h = (Math.imul(h, 1103515245) + 12345) >>> 0;
      out.push(((h >>> 16) & 1) === 1);
    }
    return out;
  }, [seed]);
  const cell = size / N;
  const finder = (x: number, y: number) => (
    <g key={`${x}${y}`}>
      <rect x={x * cell} y={y * cell} width={cell * 7} height={cell * 7} fill="var(--tri-ink)" />
      <rect x={(x + 1) * cell} y={(y + 1) * cell} width={cell * 5} height={cell * 5} fill="#0e1413" />
      <rect x={(x + 2) * cell} y={(y + 2) * cell} width={cell * 3} height={cell * 3} fill="var(--tri-ink)" />
    </g>
  );
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
  const inLogo = (x: number, y: number) => Math.abs(x - 12) <= 4 && Math.abs(y - 12) <= 4;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="companion QR code" className="shrink-0">
      <rect width={size} height={size} rx={8} fill="#0e1413" />
      {cells.map((on, i) => {
        const x = i % N;
        const y = Math.floor(i / N);
        if (!on || inFinder(x, y) || inLogo(x, y)) return null;
        return <rect key={i} x={x * cell + 0.5} y={y * cell + 0.5} width={cell - 1} height={cell - 1} rx={1} fill="var(--tri-ink)" />;
      })}
      {finder(0, 0)}
      {finder(N - 7, 0)}
      {finder(0, N - 7)}
      {/* The logo well. A rounded plate so the mark has an edge against the
          modules, then whatever the church gave us — or its generated mark. */}
      <rect x={8 * cell} y={8 * cell} width={9 * cell} height={9 * cell} rx={cell} fill="#0e1413" />
      {logo ? (
        <image href={logo} x={8.6 * cell} y={8.6 * cell} width={7.8 * cell} height={7.8 * cell} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <foreignObject x={8.6 * cell} y={8.6 * cell} width={7.8 * cell} height={7.8 * cell}>
          <div
            className="h-full w-full overflow-hidden rounded-[6px]"
            dangerouslySetInnerHTML={{ __html: avatarFor(CHURCH, { size: 64 }).svg }}
          />
        </foreignObject>
      )}
    </svg>
  );
}

const ROWS: Row[] = [
  { kind: 'segment', key: 'companionShareMode', label: 'Who can open the link', blurb: 'anyone — the link works from home. wifi-only — only phones on the church network.', value: 'anyone', options: ['anyone', 'wifi-only'] },
  { kind: 'text', key: 'streamUrl', label: 'Watch the stream', blurb: 'Your livestream address. Shown as a button on the companion page when set.', value: '', placeholder: 'https://youtube.com/…' },
  { kind: 'text', key: 'qrCompanionCaption', label: 'QR caption', blurb: 'The line under the QR code on the projector.', value: 'Scan to follow live verses, transcript, and notes' },
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

export function CompanionTile({ className }: { className?: string }) {
  const [mode, setMode] = useState<'anyone' | 'wifi-only'>('anyone');
  const [confirm, setConfirm] = useState(false);
  const [live, setLive] = useState(false);
  const logo: string | null = null; /* the church's file, when there is one */

  /*
   * The real share link, read from settings rather than drawn from a slug.
   *
   * Until the church has both a public address and an account slug there is
   * no link to encode, and a QR drawn anyway would be a code that resolves
   * to nothing — worse than no code, because someone will scan it. `link`
   * staying null is what puts the tile into its unavailable state.
   */
  const [link, setLink] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const api = typeof window === 'undefined' ? undefined : window.api;
    if (!api?.getSettings) return;
    let alive = true;
    void api
      .getSettings()
      .then((s: Record<string, unknown>) => {
        if (!alive) return;
        const base = String(s?.publicWebUrl ?? '').replace(/\/+$/, '');
        const slug = String(s?.accountSlug ?? '');
        setLink(base && slug ? `${base}/live/${slug}` : null);
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
          tone={live ? 'live' : 'default'}
          unavailable={link ? false : 'sign in and set your public address to get a scannable code'}
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
          <div className="flex h-full min-h-0 items-stretch gap-[var(--tri-gap)]">
            {/* The code is the door: press it and the tile opens. The
                controls beside it act without opening anything. */}
            <button type="button" onClick={onOpen} title="open companion settings" className="flex min-h-0 shrink-0 items-center justify-center">
              {/* Only ever drawn from a real link. A code drawn from a
                  placeholder slug is a code someone will scan, and it
                  would resolve to nothing. */}
              {link ? <PseudoQr seed={link} size={148} logo={logo} /> : <div style={{ width: 148, height: 148 }} />}
            </button>
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-0.5">
              <div className="min-w-0">
                <p className="text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em] text-[rgb(229_243_242_/_0.55)]">companion</p>
                <p className="mt-1 truncate font-mono text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.7)]">
                  {link ? link.replace(/^https?:\/\//, '') : 'no link yet'}
                </p>
                {note && (
                  <p className="mt-1 text-[length:var(--tri-size-xs)] leading-relaxed text-[rgb(234_199_198_/_0.75)]">{note}</p>
                )}
              </div>
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
        </Panel>
      )}
    >
      <RowList rows={ROWS} />
    </Expandable>
  );
}
