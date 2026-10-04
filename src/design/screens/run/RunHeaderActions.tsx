import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ActionMenu,
  Button,
  HistoryIcon,
  MediaIcon,
  NoteIcon,
  PlusIcon,
  ScanIcon,
  type ActionMenuGroup,
} from '../../../ui';
import { rowsToSchedule, type ParsedRow } from '../../../../shared/runOfServiceParse';
import { rowsToSegments } from '../../../../shared/runPlan';
import { useRun } from '../run';
import { ScanReview } from './ScanReview';
import { SEGMENT_TYPES } from './segmentTypes';
import { TriPackageActions } from './TriPackageActions';
import './run.css';

/*
 * What sits beside "run of service": the "+" and the clock.
 *
 * What the "+" offers. Two ways in at the top level — read the programme the
 * church already made, or name a segment yourself — and the second opens the
 * list rather than flying it out sideways, because there is no room beside a
 * rail pinned to the left edge.
 */
const ADD_MENU: ActionMenuGroup[] = [
  {
    items: [
      /* The one route that saves real work: the church already made a flyer,
         so read it rather than retyping it. It gets the gradient; nothing
         else in the menu does, or the emphasis means nothing. */
      { id: 'scan', label: 'scan image', icon: <ScanIcon size={14} />, accent: true },
      /* The same programme, when it arrived as a message rather than a
         sheet of paper. Same review, same parser. */
      { id: 'paste', label: 'paste programme', icon: <NoteIcon size={13} /> },
      {
        id: 'segment',
        label: 'add segment',
        icon: <PlusIcon size={13} />,
        /* Not a list of choices — a set you tick and put in order, which is
           what a run of service is. What you arrange here is literally what
           lands in the rail behind the menu. */
        arrange: true,
        items: SEGMENT_TYPES.map((t) => ({ id: t.value, label: t.label })),
      },
    ],
  },
  {
    /* Attaching to the service rather than building it — a clip or a note
       hangs off a segment rather than being one. Tiles because they are peers
       and neither leads anywhere. */
    layout: 'tiles',
    items: [
      { id: 'media', label: 'add media', icon: <MediaIcon size={15} /> },
      { id: 'note', label: 'add note', icon: <NoteIcon size={15} /> },
    ],
  },
];

interface Review {
  open: boolean;
  rows?: ParsedRow[];
  note?: string;
}

export function RunHeaderActions({ say }: { say?: (line: { text: string }) => void }) {
  const run = useRun();
  const [review, setReview] = useState<Review | null>(null);
  const [scanning, setScanning] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const clock = useRef<HTMLSpanElement>(null);

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

  const loadDefault = () => {
    run.loadSundayTemplate();
    setConfirm(false);
    say?.({ text: 'default order of service loaded' });
  };

  return (
    <div
      className="flex items-center gap-[var(--tri-gap)]"
      style={{ '--tri-control-h': '26px', '--tri-control-pad-x': '8px' } as React.CSSProperties}
    >
      <TriPackageActions />
      <ActionMenu
        groups={ADD_MENU}
        onArrange={(_parent, picked) => run.addSegments(picked)}
        onSelect={(item) => {
          if (item.id === 'scan') void scan();
          else if (item.id === 'paste') setReview({ open: true });
        }}
        trigger={<Button label="" icon={<PlusIcon size={12} />} title="add to the run" />}
      />
      <span ref={clock} className="inline-flex">
        <Button
          label=""
          tone="ash"
          icon={<HistoryIcon size={12} />}
          title="load the default order of service"
          /* An empty rail has nothing to lose, so it just loads. Anything
             already built is asked about first — right here under the
             button, not in a system dialog that stops the whole app. */
          onClick={() => (run.segments.length > 0 ? setConfirm((c) => !c) : loadDefault())}
        />
      </span>

      {confirm && (
        <ReplaceConfirm
          anchor={clock.current}
          count={run.segments.length}
          queued={run.segments.reduce((n, s) => n + s.items.length, 0)}
          onYes={loadDefault}
          onNo={() => setConfirm(false)}
        />
      )}

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
    </div>
  );
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
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const r = anchor?.getBoundingClientRect();
    const w = box.current?.offsetWidth ?? 0;
    if (!r) return;
    /* Hung from the button's left edge, because the rail is at the window's
       left and a bubble right-aligned to it would hang off-screen. */
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), top: r.bottom + 6 });
  }, [anchor]);

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
      aria-label="replace the run of service?"
      className="tri-ctx-in fixed z-[70] w-[236px] p-3"
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden',
        borderRadius: 14,
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
          <Button label="keep mine" tone="ash" onClick={onNo} />
        </span>
        <Button label="replace" tone="caution" onClick={onYes} />
      </div>
    </div>,
    document.body,
  );
}
