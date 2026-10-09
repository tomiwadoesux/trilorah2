import { useEffect, useRef, useState } from 'react';
import { Button, ChevronDownIcon, NoteIcon, PlusIcon, ScanIcon, SparkleIcon, TrashIcon, cx } from '../../../ui';
import { parseOrderOfService, formatClock, type ParsedRow } from '../../../../shared/runOfServiceParse';
import { formatMinutes, rowFlag, totalMinutes } from '../../../../shared/runPlan';
import { FlightPopup } from '../songs/FlightPopup';
import { ContextMenu, type ContextMenuState } from './ContextMenu';
import { SEGMENT_TYPES, segmentIcon, segmentTypeLabel } from './segmentTypes';

/*
 * The programme, read back before it becomes the run.
 *
 * A scan is a guess. OCR turns "8:00" into "8:OO", a church calls its sermon
 * "Ministration", and the row the matcher cannot name is as likely to be
 * the most important one on the sheet as the least. So nothing the scanner
 * finds goes into the rail directly: it lands here first, every row in the
 * church's own words with our guess beside it, and the operator says yes.
 *
 * Two ways in, one way out. A photo goes through the engine's OCR
 * (window.api.importScheduleImage); a typed programme — pasted from the
 * WhatsApp message it was sent round in, which is at least as common as a
 * printed sheet — goes through the very same parser in the renderer
 * (shared/runOfServiceParse.ts imports nothing, for exactly this). Both
 * arrive at the same list of rows and the same **add to run**.
 *
 * What is marked, and how loudly:
 *   - no type at all  → the row is gold and says "pick a type". It will go
 *     in as "something else" if left, which is a fine answer, but it should
 *     be the operator's answer rather than our silence.
 *   - a type we were under 90% sure of → a small "check" beside it. Not a
 *     colour: most of these are right, and a sheet that is half gold
 *     teaches the eye to ignore gold.
 *   Touching a row's type clears either mark — it is theirs now.
 */

export interface ScanReviewProps {
  open: boolean;
  /** Rows from a scan. Absent = open on the paste box. */
  rows?: ParsedRow[];
  /** Said once under the header — "could not read that image", say. */
  note?: string;
  onRequestClose: () => void;
  onClosed: () => void;
  /** Ask the engine for another photo. Absent when there is no engine. */
  onScanAgain?: () => void;
  onAdd: (rows: ParsedRow[]) => void;
}

interface ReviewRow extends ParsedRow {
  key: string;
  /** The operator set the type themselves; our marks no longer apply. */
  touched?: boolean;
}

const INPUT =
  'tri-rounded-control w-full border-0 bg-[rgb(0_0_0_/_0.20)] px-3.5 text-[length:var(--tri-control-size)] text-[var(--tri-ink)] placeholder:text-[rgb(229_243_242_/_0.34)] focus:outline-none focus:shadow-[inset_0_0_0_var(--tri-border)_rgb(var(--tri-go-2)_/_0.45)]';

const CELL_INPUT =
  'h-[28px] min-w-0 rounded-[5px] border-0 bg-transparent px-2 text-[length:var(--tri-control-size)] text-[var(--tri-ink)] placeholder:text-[rgb(229_243_242_/_0.3)] transition-colors hover:bg-[rgb(0_0_0_/_0.18)] focus:bg-[rgb(0_0_0_/_0.25)] focus:outline-none focus:shadow-[inset_0_0_0_var(--tri-border)_rgb(var(--tri-go-2)_/_0.45)]';

/* time · length · name · type · who · ✕ — one template for the header and
   every row, so the columns cannot drift. */
const COLS = 'grid grid-cols-[62px_50px_minmax(0,1fr)_200px_minmax(0,0.5fr)_24px] items-center gap-1.5';

let seq = 0;
const keyed = (rows: readonly ParsedRow[]): ReviewRow[] => rows.map((r) => ({ ...r, key: `r${(seq += 1)}` }));

export function ScanReview({ open, rows, note, onRequestClose, onClosed, onScanAgain, onAdd }: ScanReviewProps) {
  const [mode, setMode] = useState<'review' | 'paste'>(rows?.length ? 'review' : 'paste');
  const [list, setList] = useState<ReviewRow[]>(() => keyed(rows ?? []));
  const [text, setText] = useState('');
  const [said, setSaid] = useState(note ?? '');
  const [picker, setPicker] = useState<(ContextMenuState & { key: string }) | null>(null);
  const paste = useRef<HTMLTextAreaElement>(null);

  /* A second scan replaces the list — it is a new sheet, not more of the
     old one. */
  useEffect(() => {
    if (!rows) return;
    setList(keyed(rows));
    setMode(rows.length ? 'review' : 'paste');
  }, [rows]);
  useEffect(() => setSaid(note ?? ''), [note]);

  useEffect(() => {
    if (open && mode === 'paste') {
      /* After the flight: focusing a field in a box that is still growing
         scrolls it into a view it has not reached yet. */
      const t = setTimeout(() => paste.current?.focus({ preventScroll: true }), 420);
      return () => clearTimeout(t);
    }
  }, [open, mode]);

  const read = () => {
    const parsed = parseOrderOfService(text);
    if (parsed.length === 0) {
      setSaid('nothing in that looked like a programme — one item per line works best');
      return;
    }
    setSaid('');
    setList(keyed(parsed));
    setMode('review');
  };

  const patch = (key: string, next: Partial<ReviewRow>) =>
    setList((prev) => prev.map((r) => (r.key === key ? { ...r, ...next } : r)));

  const usable = list.filter((r) => r.title.trim() !== '');
  const unpicked = list.filter((r) => !r.touched && rowFlag(r) === 'pick').length;
  const total = totalMinutes(usable);
  const picking = picker ? list.find((r) => r.key === picker.key) : undefined;

  return (
    <FlightPopup
      open={open}
      size={{ w: 760, h: 600 }}
      label="order of service — review"
      onRequestClose={onRequestClose}
      onClosed={onClosed}
      header={
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-[var(--tri-ink)]">order of service</h2>
          <p className="mt-1 text-[length:var(--tri-size-xs)] lowercase leading-relaxed text-[rgb(229_243_242_/_0.5)]">
            {mode === 'review'
              ? 'this is what was read. fix anything that is wrong — nothing joins the run until you add it.'
              : 'paste or type the programme, one item per line. times, minutes and names are picked out for you.'}
          </p>
        </div>
      }
      footer={
        <footer className="flex shrink-0 items-center gap-2 px-6 pb-5 pt-3">
          {mode === 'review' ? (
            <>
              <Button label="paste text" tone="ash" icon={<NoteIcon size={12} />} onClick={() => setMode('paste')} />
              {onScanAgain && <Button label="scan another" tone="ash" icon={<ScanIcon size={12} />} onClick={onScanAgain} />}
              <span className="min-w-0 flex-1 truncate text-right text-[length:var(--tri-size-xs)] lowercase tabular-nums text-[var(--tri-ink-muted)]" aria-live="polite">
                {usable.length} {usable.length === 1 ? 'segment' : 'segments'}
                {total > 0 ? ` · ${formatMinutes(total)}` : ''}
                {unpicked > 0 ? ` · ${unpicked} without a type` : ''}
              </span>
              <Button
                label="add to run"
                tone="go"
                icon={<PlusIcon size={12} />}
                disabled={usable.length === 0}
                onClick={() => onAdd(usable.map(({ key: _key, touched: _touched, ...row }) => row))}
              />
            </>
          ) : (
            <>
              {list.length > 0 && <Button label="back to the list" tone="ash" onClick={() => setMode('review')} />}
              {onScanAgain && <Button label="scan an image instead" tone="ash" icon={<ScanIcon size={12} />} onClick={onScanAgain} />}
              <span className="flex-1" />
              <Button label="read it" tone="go" icon={<SparkleIcon size={12} />} disabled={!text.trim()} onClick={read} />
            </>
          )}
        </footer>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-6 pt-4">
        {said && (
          <p className="shrink-0 px-1 text-[length:var(--tri-size-xs)] lowercase leading-relaxed text-[var(--tri-accent-yellow)]" aria-live="polite">
            {said}
          </p>
        )}

        {mode === 'paste' ? (
          <textarea
            ref={paste}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) read();
            }}
            spellCheck={false}
            aria-label="the programme, as text"
            placeholder={'8:00am - opening prayer\n8:10 - praise & worship (choir)\n9:05 sermon — pastor dan\nchildren dedication .... 10 mins'}
            className={cx(INPUT, 'min-h-0 flex-1 resize-none py-3 leading-[1.6]')}
          />
        ) : (
          <>
            <div className={cx(COLS, 'shrink-0 px-2 text-[length:var(--tri-size-eyebrow)] uppercase tracking-[0.14em] text-[rgb(229_243_242_/_0.38)]')}>
              <span>time</span>
              <span>length</span>
              <span className="pl-2">what the sheet says</span>
              <span className="pl-2">type</span>
              <span className="pl-2">who</span>
              <span />
            </div>
            <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto px-1 pb-1">
              {list.map((row) => {
                const flag = row.touched ? null : rowFlag(row);
                const type = row.type ?? 'custom';
                return (
                  <li
                    key={row.key}
                    title={row.raw ? `read as: ${row.raw}` : undefined}
                    className={cx(
                      COLS,
                      'shrink-0 rounded-[6px] px-2 py-[3px] transition-colors',
                      flag === 'pick' ? 'bg-[rgb(228_216_122_/_0.07)] shadow-[inset_0_0_0_var(--tri-border)_rgb(228_216_122_/_0.22)]' : 'bg-[rgb(0_0_0_/_0.14)]',
                    )}
                  >
                    <span className="truncate text-[length:var(--tri-size-xs)] lowercase tabular-nums text-[var(--tri-ink-muted)]">
                      {row.time ? formatClock(row.time.start).toLowerCase() : '—'}
                    </span>
                    <span
                      className={cx(
                        'truncate text-[length:var(--tri-size-xs)] tabular-nums',
                        /* A length we worked out from the next row's start is
                           softer than one the sheet printed. */
                        row.durationDerived ? 'text-[rgb(229_243_242_/_0.36)]' : 'text-[var(--tri-ink-muted)]',
                      )}
                      title={row.durationDerived ? 'worked out from the next start time' : undefined}
                    >
                      {row.durationMin !== undefined ? formatMinutes(row.durationMin) : '—'}
                    </span>
                    <input
                      value={row.title}
                      onChange={(e) => patch(row.key, { title: e.target.value })}
                      aria-label="segment name"
                      spellCheck={false}
                      className={cx(CELL_INPUT, 'w-full')}
                    />
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-label={`type: ${flag === 'pick' ? 'not picked' : segmentTypeLabel(type)}`}
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setPicker({ key: row.key, x: r.left, y: r.bottom + 4, from: e.currentTarget });
                      }}
                      className={cx(
                        'flex h-[28px] min-w-0 items-center gap-2 rounded-[5px] px-2 text-left text-[length:var(--tri-control-size)] lowercase transition-colors',
                        'hover:bg-[rgb(0_0_0_/_0.18)] focus-visible:bg-[rgb(0_0_0_/_0.25)] focus-visible:outline-none',
                        flag === 'pick' ? 'text-[var(--tri-accent-yellow)]' : 'text-[var(--tri-ink)]',
                      )}
                    >
                      <span className={cx('grid w-[14px] shrink-0 place-items-center', flag === 'pick' ? '' : 'text-[rgb(143_211_192_/_0.85)]')}>
                        {segmentIcon(flag === 'pick' ? 'custom' : type, 13)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{flag === 'pick' ? 'pick a type' : segmentTypeLabel(type)}</span>
                      {flag === 'check' && (
                        <span
                          title={row.alias ? `matched on “${row.alias}” — worth a look` : 'a guess — worth a look'}
                          className="shrink-0 rounded-md bg-[rgb(255_255_255_/_0.07)] px-1.5 text-[length:var(--tri-size-eyebrow)] lowercase tracking-wide text-[rgb(229_243_242_/_0.55)]"
                        >
                          check
                        </span>
                      )}
                      <ChevronDownIcon size={10} className="shrink-0 text-[rgb(229_243_242_/_0.4)]" />
                    </button>
                    <input
                      value={row.person ?? ''}
                      onChange={(e) => patch(row.key, { person: e.target.value || undefined })}
                      placeholder="—"
                      aria-label="who leads it"
                      spellCheck={false}
                      className={cx(CELL_INPUT, 'w-full text-[var(--tri-ink-muted)]')}
                    />
                    <button
                      type="button"
                      onClick={() => setList((prev) => prev.filter((r) => r.key !== row.key))}
                      title="leave this row out"
                      aria-label={`leave ${row.title} out`}
                      className="grid size-[24px] place-items-center rounded-[5px] text-[rgb(229_243_242_/_0.35)] transition-colors hover:bg-[rgb(255_255_255_/_0.06)] hover:text-[var(--tri-ink-danger)] focus-visible:text-[var(--tri-ink-danger)] focus-visible:outline-none"
                    >
                      <TrashIcon size={11} />
                    </button>
                  </li>
                );
              })}
              {list.length === 0 && (
                <li className="px-2 py-6 text-center text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.35)]">
                  every row was left out — paste the text again, or close this
                </li>
              )}
            </ul>
          </>
        )}
      </div>

      <ContextMenu
        at={picker}
        label="segment type"
        items={SEGMENT_TYPES.map((t) => ({
          id: t.value,
          label: t.label,
          icon: segmentIcon(t.value, 13),
          checked: !!picking && (picking.touched || picking.type !== null) && (picking.type ?? 'custom') === t.value,
        }))}
        onClose={() => setPicker(null)}
        onSelect={(item) => {
          if (picker) patch(picker.key, { type: item.id, touched: true });
          picker?.from?.focus({ preventScroll: true });
        }}
      />
    </FlightPopup>
  );
}
