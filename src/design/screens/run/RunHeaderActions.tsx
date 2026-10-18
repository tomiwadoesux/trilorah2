import { usePopupPlacement, popupBounds } from '../../../ui/primitives/usePopupPlacement';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Button,
  HistoryIcon,
} from '../../../ui';
import { rowsToSchedule, type ParsedRow } from '../../../../shared/runOfServiceParse';
import { rowsToSegments } from '../../../../shared/runPlan';
import { useRun } from '../run';
import { ScanReview } from './ScanReview';
import { TriPackageActions } from './TriPackageActions';
import './run.css';

/*
 * Programme dialogs stay mounted alongside the rail and are opened by the
 * full schedule's service tools.
 */
export type RunAsk = 'scan' | 'paste' | 'tri' | 'components';
const RUN_ASK_EVENT = 'trilorah-run-ask';
export const TRI_OPEN_EVENT = 'trilorah-open-tri';

export function askRun(what: RunAsk) {
  window.dispatchEvent(what === 'tri' ? new Event(TRI_OPEN_EVENT) : new CustomEvent<RunAsk>(RUN_ASK_EVENT, { detail: what }));
}

interface Review {
  open: boolean;
  rows?: ParsedRow[];
  note?: string;
}

export function RunHeaderActions({
  say,
  onOverlayChange,
}: {
  say?: (line: { text: string }) => void;
  onOverlayChange?: (open: boolean) => void;
}) {
  const run = useRun();
  const [review, setReview] = useState<Review | null>(null);
  const [scanning, setScanning] = useState(false);
  const [triOpen, setTriOpen] = useState(false);
  useEffect(() => { onOverlayChange?.(triOpen || scanning || !!review?.open); }, [triOpen, scanning, review?.open, onOverlayChange]);

  const canScan = typeof window !== 'undefined' && !!window.api?.importScheduleImage;

  /*
   * The native picker, then the OCR, then the review — never straight into
   * the rail. Every way this can come back empty has its own sentence,
   * because "nothing happened" after choosing a photo is the one outcome
   * that makes someone stop trusting the button: they land on the paste box
   * with the reason above it, which is also the way forward.
   */
  const scan = async () => {
    const api = window.api;
    if (!api?.importScheduleImage) {
      setReview({ open: true, note: 'scanning needs the desktop app — paste the programme as text instead' });
      return;
    }
    if (scanning) return;
    setScanning(true);
    try {
      const res = await api.importScheduleImage();
      if (res.canceled) return;
      const rows = res.rows ?? [];
      if (rows.length > 0) setReview({ open: true, rows });
      else
        setReview({
          open: true,
          note: res.error
            ? `could not read that image (${res.error.toLowerCase()}) — paste the programme as text instead`
            : 'no programme could be read from that image — a straighter, closer photo helps, or paste it as text',
        });
    } catch {
      setReview({ open: true, note: 'the scan failed — paste the programme as text instead' });
    } finally {
      setScanning(false);
    }
  };

  const scanRef = useRef(scan);
  scanRef.current = scan;
  useEffect(() => {
    const onAsk = (e: Event) => {
      const what = (e as CustomEvent<RunAsk>).detail;
      if (what === 'scan') void scanRef.current();
      else if (what === 'paste') setReview({ open: true });
    };
    window.addEventListener(RUN_ASK_EVENT, onAsk);
    return () => window.removeEventListener(RUN_ASK_EVENT, onAsk);
  }, []);

  return (
    <>
      <TriPackageActions showTrigger={false} onOpenChange={setTriOpen} />

      {review && (
        <ScanReview
          open={review.open}
          rows={review.rows}
          note={review.note}
          onRequestClose={() => setReview((r) => (r ? { ...r, open: false } : r))}
          onClosed={() => setReview(null)}
          onScanAgain={canScan ? () => void scan() : undefined}
          onAdd={(rows) => {
            run.addSegments(rowsToSegments(rows));
            window.dispatchEvent(new CustomEvent('trilorah-guide-observed', { detail: 'programme-added' }));
            /* The engine gets the same rows, so what it expects next and
               what the rail shows next are one list. It REPLACES the
               engine's schedule: that is what set-service-schedule does,
               and a scanned programme is the whole service. */
            window.api?.setServiceSchedule?.(rowsToSchedule(rows));
            say?.({ text: `${rows.length} ${rows.length === 1 ? 'segment' : 'segments'} added to the run` });
            setReview((r) => (r ? { ...r, open: false } : r));
          }}
        />
      )}
    </>
  );
}

export function DefaultRunButton({ label = '', onLoaded }: { label?: string; onLoaded?: () => void }) {
  const run = useRun();
  const [confirm, setConfirm] = useState(false);
  const clock = useRef<HTMLSpanElement>(null);
  const dismiss = () => { setConfirm(false); clock.current?.querySelector('button')?.focus({ preventScroll: true }); };
  const loadDefault = () => {
    run.loadSundayTemplate();
    dismiss();
    onLoaded?.();
  };
  return <>
    <span ref={clock} className="inline-flex"><Button guideId="run-default" label={label} tone="ash" icon={<HistoryIcon size={14} />} title="Load the default order of service" onClick={() => run.segments.length ? setConfirm(c => !c) : loadDefault()} /></span>
    {confirm && <ReplaceConfirm anchor={clock.current} count={run.segments.length} queued={run.segments.reduce((n, s) => n + s.items.length, 0)} onYes={loadDefault} onNo={dismiss} />}
  </>;
}

/*
 * "Replace the run?" — a bubble hung from the clock.
 *
 * The same floating surface as the menus beside it, because it is the same
 * kind of thing: a small question asked at the control that raised it. The
 * keeping answer is the default (it holds focus, and Esc or a click away
 * means it); replacing is the caution tone, which is what gold is for —
 * deliberate, not dangerous. What would be lost is said in numbers, so
 * "replace" is weighed against "3 segments and 5 things queued in them"
 * rather than against nothing.
 */
function ReplaceConfirm({
  anchor,
  count,
  queued,
  onYes,
  onNo,
}: {
  anchor: HTMLElement | null;
  count: number;
  queued: number;
  onYes: () => void;
  onNo: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  const pos = usePopupPlacement(true, anchorRef, box, 'left');

  useEffect(() => {
    box.current?.querySelector<HTMLElement>('[data-keep] button, button[data-keep]')?.focus({ preventScroll: true });
  }, [pos !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node) && !anchor?.contains(e.target as Node)) onNo();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onNo();
      anchor?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [anchor, onNo]);

  return createPortal(
    <div
      ref={box}
      role="alertdialog"
      aria-modal="true"
      aria-label="replace the run of service?"
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        event.stopPropagation();
        const buttons = [...(box.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
      }}
      className="tri-ctx-in fixed z-[70] w-[236px] p-3"
      style={{
        ...popupBounds,
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden',
        borderRadius: 6,
        backgroundColor: 'var(--tri-pop)',
        boxShadow: '0 14px 36px rgb(0 0 0 / 0.75), inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.16)',
      }}
    >
      <p className="text-[length:var(--tri-size)] font-semibold lowercase text-[var(--tri-ink)]">replace the run?</p>
      <p className="mt-1 text-[length:var(--tri-size-xs)] lowercase leading-relaxed text-[rgb(229_243_242_/_0.55)]">
        the default order takes the place of{' '}
        <span className="tabular-nums text-[var(--tri-ink-muted)]">
          {count} {count === 1 ? 'segment' : 'segments'}
        </span>
        {queued > 0 ? (
          <>
            {' '}
            and the{' '}
            <span className="tabular-nums text-[var(--tri-ink-muted)]">
              {queued} {queued === 1 ? 'thing' : 'things'}
            </span>{' '}
            queued in them
          </>
        ) : null}
        .
      </p>
      <div className="mt-3 flex justify-end gap-2" style={{ '--tri-control-h': '28px' } as React.CSSProperties}>
        <span data-keep className="inline-flex">
          <Button guideId="run-replace-keep" label="keep mine" tone="ash" onClick={onNo} />
        </span>
        <Button guideId="run-replace-confirm" label="replace" tone="caution" onClick={onYes} />
      </div>
    </div>,
    document.body,
  );
}
