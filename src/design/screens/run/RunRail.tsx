import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ActionMenu,
  ArrowIcon,
  BookIcon,
  Button,
  HistoryIcon,
  ChevronDownIcon,
  CloseIcon,
  ClockIcon,
  CopyIcon,
  MediaIcon,
  MusicIcon,
  NoteIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  type ActionMenuGroup,
  cx,
  surface,
} from '../../../ui';
import { formatMinutes } from '../../../../shared/runPlan';
import { formatClock } from '../../../../shared/runOfServiceParse';
import { useDrag } from '../drag';
import { useEngine } from '../engine';
import { useProjector } from '../projector';
import { useRun, type QueueItem, type RunSegment } from '../run';
import { ContextMenu, useContextMenu, type ContextMenuItem } from './ContextMenu';
import { RunSongEditor, type LibrarySong } from './RunSongEditor';
import { SEGMENT_TYPES, segmentIcon, segmentTypeLabel } from './segmentTypes';
import './run.css';
import { EmptyMark, PopStackArt } from '../emptyArt';

/*
 * The run of service, as drawn in the rail.
 *
 * Lifted out of Live.tsx when it grew a right-click menu, an inline rename
 * and a song editor: the state for the run was already its own module
 * (../run) and the drawing of it had become the biggest single thing left
 * in the screen file. What stays in Live is only what Live alone knows —
 * the segment's "+" menu is built from that file's fixture songs and sample
 * references, so it arrives as `renderAdd`.
 */

const EMPTY_SEGMENT_HINT = 'use + , or hold a row below and drag it here';

/* What a church actually plans a segment at. Not a spinner: this is picked
   from a menu mid-week, and eight rounded choices cover a printed order of
   service better than a field nobody wants to type into. */
const PLANNED_MINUTES = [5, 10, 15, 20, 30, 40, 45, 60];

/** The hover ✕ on a queued item. Parent row needs the `group` class. */
function RemoveItem({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="remove"
      aria-label="remove"
      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-60 group-focus-within:opacity-60 hover:opacity-100 focus-visible:opacity-100"
    >
      <CloseIcon size={10} />
    </button>
  );
}

/*
 * The source's own mark, standing where the dash was.
 *
 * A dash says "an item"; the operator's question is "WHICH item", and at a
 * glance, mid-service. So scripture wears the book, a song the note pair, a
 * note its page — and an image shows the image itself, because no glyph
 * reminds anyone which photo they queued. Mint, like the menu's icons: the
 * marks are wayfinding, not content.
 *
 * In a fixed 18px box whatever it holds, so every label in a segment starts
 * on the same vertical line — a 12px glyph beside an 18px thumbnail used to
 * stagger them.
 */
function ItemMark({ item }: { item: QueueItem }) {
  const glyph = () => {
    if ((item.source === 'media' || item.source === 'presentation') && item.preview) {
      return <img src={item.preview} alt="" className="size-[18px] rounded-[5px] object-cover" />;
    }
    if (item.source === 'scripture') return <BookIcon size={12} />;
    if (item.source === 'song') return <MusicIcon size={12} />;
    if (item.source === 'note') return <NoteIcon size={12} />;
    return <MediaIcon size={12} />;
  };
  return <span className="grid size-[18px] shrink-0 place-items-center text-[rgb(143_211_192_/_0.6)]">{glyph()}</span>;
}

/** "Amazing Grace — Verse 1" → the song, and the part of it. The title is
    what the operator scans for; the section is which slide of it. */
function splitSongLabel(item: QueueItem): { main: string; part?: string } {
  if (item.source !== 'song') return { main: item.label };
  if (item.title && item.section) return { main: item.title, part: item.section };
  const [main, part] = item.label.split(/\s+[—–]\s+/);
  return { main: main || item.label, part };
}

/** One queued thing, with what its source earns it: a verse can go live
    from here, a note is edited in place, an image shows itself. */
function QueuedItemRow({
  segKey,
  item,
  onEditSong,
}: {
  segKey: string;
  item: QueueItem;
  onEditSong: (item: QueueItem, origin: HTMLElement | null) => void;
}) {
  const run = useRun();
  const projector = useProjector();
  const engine = useEngine();
  const menu = useContextMenu();
  const rowRef = useRef<HTMLLIElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  const isVerse = item.source === 'scripture';
  const canGoLive = isVerse || (item.source === 'song' && !!item.lines) || !!item.path;
  const live = canGoLive && projector.isLive(item.source === 'note' ? 'scripture' : item.source, item.label);

  /* A verse is pushed through the engine, which looks the text up and logs
     the review item — sending it to the projector context alone would light
     the row and show the congregation nothing. A song or a picture carries
     its own content and goes straight out. */
  const putUp = () => {
    if (isVerse) {
      engine.pushReference(item.label);
      projector.send({ source: 'scripture', id: item.label, label: item.label });
    } else if (item.source === 'song' && item.lines) {
      projector.send({
        source: 'song',
        id: item.label,
        label: item.label,
        title: item.title,
        section: item.section,
        lines: item.lines,
      });
    } else if (item.path && (item.source === 'media' || item.source === 'presentation')) {
      projector.send({ source: item.source, id: item.label, label: item.label, path: item.path, mediaKind: item.mediaKind });
    }
  };

  /* What a right-click offers is what THIS row can actually do: a song can
     be opened in the editor, a note already is its own editor so "edit"
     means "put the cursor in it", and everything can leave. */
  const items: ContextMenuItem[] = [
    ...(item.source === 'song' ? [{ id: 'edit-song', label: 'edit song', icon: <PencilIcon size={12} /> }] : []),
    ...(item.source === 'note' ? [{ id: 'edit-note', label: 'edit note', icon: <PencilIcon size={12} /> }] : []),
    { id: 'remove', label: 'remove', icon: <TrashIcon size={11} />, danger: true },
  ];

  const { main, part } = splitSongLabel(item);

  return (
    <li
      ref={rowRef}
      tabIndex={0}
      {...menu.bind}
      data-menu={menu.at ? 'true' : undefined}
      className={cx(
        'group flex items-center gap-1.5 rounded-[8px] py-[4px] pl-1.5 pr-2 text-[length:var(--tri-size-body)] outline-none transition-colors',
        'bg-[rgb(0_0_0_/_0.14)] text-[rgb(229_243_242_/_0.72)]',
        'focus-visible:bg-[rgb(255_255_255_/_0.07)] data-[menu=true]:bg-[rgb(255_255_255_/_0.07)]',
      )}
    >
      <ItemMark item={item} />

      {item.source === 'note' ? (
        /* The row IS the editor. No edit mode, no pencil, no dialog — a note
           in the run is a line of text you can always put the cursor in. */
        <input
          ref={noteRef}
          /* A note added from the + arrives blank, and a blank line you
             then have to click into is a step nobody expects. */
          autoFocus={item.label === ''}
          value={item.label}
          onChange={(e) => run.updateItem(segKey, item.key, e.target.value)}
          placeholder="type a note…"
          className="min-w-0 flex-1 bg-transparent text-[length:var(--tri-size-body)] text-[rgb(229_243_242_/_0.72)] placeholder:text-[rgb(229_243_242_/_0.28)] focus:outline-none"
        />
      ) : (
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5" title={item.label}>
          <span className="min-w-0 truncate">{main}</span>
          {part && (
            <span className="max-w-[45%] shrink-0 truncate text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.4)]">
              {part}
            </span>
          )}
        </span>
      )}

      {canGoLive && (
        /*
         * The push. A single deliberate click, not the browser's
         * double-click: everything in this list was queued on purpose
         * before the service, which is the deliberation the two-step
         * gesture exists to force. Hidden until hover while idle; once
         * live it holds the gold pill and clicking again takes it down.
         */
        <button
          type="button"
          onClick={() => (live ? projector.clear() : putUp())}
          title={live ? 'take it off the projector' : `put this ${isVerse ? 'verse' : item.source} on the projector`}
          className={cx(
            'shrink-0 rounded-full px-1.5 py-[1px] text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.12em] transition-all',
            live
              ? 'bg-[rgb(228_216_122_/_0.16)] text-[var(--tri-accent-yellow)]'
              : 'text-[rgb(229_243_242_/_0.4)] opacity-0 hover:text-[var(--tri-accent-yellow)] focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100',
          )}
        >
          live
        </button>
      )}

      <RemoveItem onClick={() => run.remove(segKey, item.key)} />

      <ContextMenu
        at={menu.at}
        label={`${item.label || 'note'} — actions`}
        items={items}
        onClose={menu.close}
        onSelect={(picked) => {
          if (picked.id === 'remove') run.remove(segKey, item.key);
          else if (picked.id === 'edit-note') noteRef.current?.focus();
          else if (picked.id === 'edit-song') onEditSong(item, rowRef.current);
        }}
      />
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* One segment                                                         */
/* ------------------------------------------------------------------ */

function SegmentCard({
  seg,
  index,
  total,
  over,
  dropProps,
  renderAdd,
  onEditSong,
}: {
  seg: RunSegment;
  index: number;
  /** How many cards the run has — the last one has nowhere to move down. */
  total: number;
  over: boolean;
  dropProps: { 'data-drop-segment': string };
  renderAdd: (seg: RunSegment) => ReactNode;
  onEditSong: (segKey: string, item: QueueItem, origin: HTMLElement | null) => void;
}) {
  const run = useRun();
  const menu = useContextMenu();
  const open = run.isOpen(seg.key);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(seg.label);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) return;
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [renaming]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== seg.label) run.renameSegment(seg.key, next.toLowerCase());
    setRenaming(false);
  };

  /*
   * The card's menu, in the order a Sunday reaches for it: where it sits,
   * then what it is, then what is in it, then the destructive pair.
   *
   * Moving is here because dragging a 200px card mid-service is a
   * precision gesture and these two rows are not; inserting is here
   * because the header's + appends to the END of the run, which is never
   * where a segment added mid-service belongs. Rows that cannot act are
   * left out rather than shown dead: the first card has no "move up", an
   * empty one has nothing to clear.
   */
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const items: ContextMenuItem[] = [
    ...(isFirst ? [] : [{ id: 'up', label: 'move up', icon: <ArrowIcon size={11} className="-rotate-90" /> }]),
    ...(isLast ? [] : [{ id: 'down', label: 'move down', icon: <ArrowIcon size={11} className="rotate-90" /> }]),
    {
      id: 'insert',
      label: 'add a segment',
      icon: <PlusIcon size={12} />,
      items: [
        { id: 'insert:above', label: 'above this one', icon: <ArrowIcon size={11} className="-rotate-90" /> },
        { id: 'insert:below', label: 'below this one', icon: <ArrowIcon size={11} className="rotate-90" /> },
      ],
    },
    { id: 'rename', label: 'rename', icon: <PencilIcon size={12} /> },
    {
      id: 'type',
      label: 'change type',
      icon: segmentIcon(seg.type, 13),
      items: SEGMENT_TYPES.map((t) => ({
        id: `type:${t.value}`,
        label: t.label,
        icon: segmentIcon(t.value, 13),
        checked: t.value === seg.type,
      })),
    },
    {
      id: 'minutes',
      label: 'planned length',
      icon: <ClockIcon size={12} />,
      items: [
        ...PLANNED_MINUTES.map((m) => ({
          id: `minutes:${m}`,
          label: formatMinutes(m),
          checked: seg.durationMin === m,
        })),
        { id: 'minutes:none', label: 'no length', checked: seg.durationMin === undefined },
      ],
    },
    { id: 'duplicate', label: 'duplicate', icon: <CopyIcon size={12} /> },
    ...(seg.items.length === 0
      ? []
      : [{ id: 'clear', label: `remove the ${seg.items.length} queued`, icon: <TrashIcon size={11} />, danger: true }]),
    { id: 'remove', label: 'remove from the run', icon: <TrashIcon size={11} />, danger: true },
  ];

  const minutes = seg.durationMin !== undefined && seg.durationMin > 0 ? formatMinutes(seg.durationMin) : '';

  return (
    <li
      {...dropProps}
      data-active={open || undefined}
      data-menu={menu.at ? 'true' : undefined}
      className={cx(
        surface({ shape: 'panel', tone: 'gold', wide: true, interactive: true }),
        over && 'tri-surface--gold',
        'run-seg relative shrink-0 overflow-hidden',
      )}
      /*
       * The system teal, held at half its resting voltage. Only the REST
       * alpha is overridden — hover and the open card's active state still
       * reach their full values through the normal channels, so a card
       * wakes up exactly like every other control and merely sleeps more
       * quietly.
       */
      style={{ borderRadius: 12, '--tri-alpha-rest': 0.15 } as CSSProperties}
    >
      <div {...menu.pointer} className="relative flex items-center gap-1.5 py-[5px] pl-2.5 pr-[9px]">
        {renaming ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 py-1">
            <span className="w-4 shrink-0 text-right text-[length:var(--tri-size-xs)] tabular-nums text-[rgb(229_243_242_/_0.38)]">
              {index + 1}
            </span>
            <span className="grid size-[14px] shrink-0 place-items-center text-[rgb(143_211_192_/_0.5)]">
              {segmentIcon(seg.type, 12)}
            </span>
            <input
              ref={nameRef}
              value={draft}
              aria-label="segment name"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                else if (e.key === 'Escape') {
                  e.stopPropagation();
                  setRenaming(false);
                }
              }}
              /* Same size and ink as the label it replaces, on a faint well:
                 the name becomes editable where it stands rather than a box
                 arriving over it. */
              className="min-w-0 flex-1 rounded-[6px] bg-[rgb(0_0_0_/_0.25)] px-1.5 py-[2px] text-[length:var(--tri-size)] lowercase text-[var(--tri-ink)] outline-none ring-1 ring-[rgb(143_211_192_/_0.35)]"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => run.toggleOpen(seg.key)}
            aria-expanded={open}
            {...menu.keys}
            className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-[length:var(--tri-size)] lowercase outline-none"
          >
            {/* The number stays. With seven near-identical slabs it is the
                only thing that says "fourth", and "what's after four?" is
                how a service is talked about over comms. */}
            <span className="w-4 shrink-0 text-right text-[length:var(--tri-size-xs)] tabular-nums text-[rgb(229_243_242_/_0.38)]">
              {index + 1}
            </span>
            {/* The type's mark, worn on the card and not only in its menu:
                seven near-identical slabs told apart by words alone made
                the rail read as a list of labels. Mint at the item marks'
                voltage — wayfinding, not content — and a step brighter on
                the open card, whose contents it is naming. */}
            <span
              className={cx(
                'grid size-[14px] shrink-0 place-items-center transition-colors',
                open ? 'text-[rgb(143_211_192_/_0.85)]' : 'text-[rgb(143_211_192_/_0.5)]',
              )}
            >
              {segmentIcon(seg.type, 12)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className={cx(
                    'min-w-0 truncate transition-colors',
                    open ? 'text-[var(--tri-ink)]' : 'text-[rgb(229_243_242_/_0.78)]',
                  )}
                >
                  {seg.label}
                </span>
                {/* The chevron rides the name rather than the far edge: it
                    belongs to what it discloses, and out at the edge it was
                    one more thing in the button cluster. */}
                <ChevronDownIcon
                  size={10}
                  className={cx(
                    'shrink-0 text-[rgb(229_243_242_/_0.4)] transition-transform duration-150',
                    open ? 'rotate-0' : '-rotate-90',
                  )}
                />
              </span>
              {/* A printed start time, when the programme had one. Its own
                  line because it is the church's fact, not ours — and beside
                  a long name in a 200px rail there is no room on the first. */}
              {seg.startMin !== undefined && (
                <span className="truncate text-[length:var(--tri-size-eyebrow)] tabular-nums lowercase text-[rgb(229_243_242_/_0.4)]">
                  {formatClock(seg.startMin).toLowerCase()}
                </span>
              )}
            </span>
          </button>
        )}

        {/*
         * One place, two tenants — see run.css. At rest, how long the
         * segment is planned to run; under the pointer or the keyboard, the
         * two things you can do to it, laid OVER the right end of the header
         * rather than beside it. A slot reserved for them cost every title
         * 48px of a 200px rail, all the time, for buttons that are wanted a
         * few times a service; this way "closing prayer & benediction" keeps
         * its words and gives up its tail only while it is being acted on.
         * The count of queued items that used to sit here is gone at the
         * owner's call: open the card and the items are right there, and
         * closed it was a number nobody acted on.
         */}
        {minutes && (
          <span className="run-seg-plan pointer-events-none shrink-0 whitespace-nowrap pr-0.5 text-[length:var(--tri-size-xs)] tabular-nums text-[rgb(229_243_242_/_0.4)]">
            {minutes}
          </span>
        )}
        <div className="run-seg-actions absolute right-[7px] top-[5px] flex h-[30px] items-center gap-1 pl-5">
          {renderAdd(seg)}
          {/* The undo of the +, in the danger set, glyph only — the trash
              already says it, and a card is no place for the word "delete"
              seven times over. */}
          <button
            type="button"
            onClick={() => run.removeSegment(seg.key)}
            title={`remove ${seg.label} from the run`}
            aria-label={`remove ${seg.label} from the run`}
            className={cx(
              surface({ tone: 'danger', interactive: true }),
              'flex size-[22px] shrink-0 items-center justify-center text-[var(--tri-ink-danger)]',
            )}
            style={{ borderRadius: 8 }}
          >
            <TrashIcon size={11} />
          </button>
        </div>
      </div>

      {open && (
        <div className="px-2 pb-2">
          {/* The rule starts where the name starts, not at the card edge —
              contents belong to the name, not to the slab. */}
          <div aria-hidden className="mb-1 ml-[48px] h-px bg-[rgb(255_255_255_/_0.07)]" />
          {/* Separated by shape, not by rule. Hairlines here fought the one
              under the header — two grades of horizontal line in a 200px
              card, with the lesser one running longer. A faint well under
              each row makes the entries discrete the way the cards
              themselves are: fills on a surface, and the header rule stays
              the only line in the card. */}
          <ul className="flex flex-col gap-[3px]">
            {seg.items.length === 0 ? (
              /* A dashed well, not a sentence adrift: the hint names a drop
                 target, so it is drawn as one — the same shape the card
                 itself takes when a drag is over it. */
              <li className="grid place-items-center rounded-[8px] border border-dashed border-[rgb(255_255_255_/_0.1)] px-3 py-[7px] text-center text-[length:var(--tri-size-xs)] lowercase leading-snug text-[rgb(229_243_242_/_0.32)]">
                {EMPTY_SEGMENT_HINT}
              </li>
            ) : (
              seg.items.map((item) => (
                <QueuedItemRow
                  key={item.key}
                  segKey={seg.key}
                  item={item}
                  onEditSong={(it, origin) => onEditSong(seg.key, it, origin)}
                />
              ))
            )}
          </ul>
        </div>
      )}

      <ContextMenu
        at={menu.at}
        label={`${seg.label} — segment actions`}
        items={items}
        onClose={menu.close}
        onSelect={(picked) => {
          if (picked.id === 'rename') {
            setDraft(seg.label);
            setRenaming(true);
          } else if (picked.id === 'up') run.moveSegment(seg.key, -1);
          else if (picked.id === 'down') run.moveSegment(seg.key, 1);
          else if (picked.id === 'duplicate') run.duplicateSegment(seg.key);
          else if (picked.id === 'clear') run.clearSegment(seg.key);
          else if (picked.id === 'remove') run.removeSegment(seg.key);
          else if (picked.id.startsWith('insert:')) {
            /* A blank custom segment, named for what it is. The operator is
               about to rename it or set its type, and both are one more
               right-click away on the card that appears. */
            run.insertSegment(seg.key, picked.id.slice(7) as 'above' | 'below', {
              id: 'custom',
              label: segmentTypeLabel('custom'),
            });
          } else if (picked.id.startsWith('minutes:')) {
            const rest = picked.id.slice(8);
            run.setSegmentDuration(seg.key, rest === 'none' ? undefined : Number(rest));
          } else if (picked.id.startsWith('type:')) {
            const id = picked.id.slice(5);
            /* The name follows the type only while it is still the old
               type's stock name — see run.setSegmentType. */
            run.setSegmentType(seg.key, { id, label: segmentTypeLabel(id) }, segmentTypeLabel(seg.type));
          }
        }}
      />
    </li>
  );
}

/**
 * The run list — the cards variant carrying the rows variant's anatomy.
 *
 * Chosen from four live candidates, then merged: the slab is what won from
 * cards — each segment a physical object in the system's own gradient
 * surface, so state lives in the material (hover lights it like a button,
 * the open card holds the active alpha, a drop target turns gold) — and the
 * row anatomy is what won from rows: the quiet tabular number in the
 * margin, the chevron, marked items. The cards variant's ghost numerals are
 * gone at the owner's call, and so now is the count pill.
 */

/*
 * The empty rail's own way in — the header's + and clock again, at a size
 * you cannot miss, directly under the sentence that names them. The + here
 * offers only "add segment": the scan and paste flows live in the header,
 * whose review popovers they belong to. The clock loads straight away, as
 * the header's does when the rail is empty — there is nothing to replace.
 */
const EMPTY_ADD: ActionMenuGroup[] = [
  {
    items: [
      {
        id: 'segment',
        label: 'add segment',
        icon: <PlusIcon size={13} />,
        arrange: true,
        items: SEGMENT_TYPES.map((t) => ({ id: t.value, label: t.label })),
      },
    ],
  },
];

function RunEmptyActions() {
  const run = useRun();
  return (
    <div
      className="mt-4 flex items-center gap-3"
      style={{ '--tri-control-h': '40px', '--tri-control-pad-x': '13px' } as CSSProperties}
    >
      <ActionMenu
        groups={EMPTY_ADD}
        onArrange={(_parent, picked) => run.addSegments(picked)}
        trigger={<Button label="" icon={<PlusIcon size={17} />} title="add to the run" />}
      />
      <Button
        label=""
        tone="ash"
        icon={<HistoryIcon size={16} />}
        title="load the default order of service"
        onClick={() => run.loadSundayTemplate()}
      />
    </div>
  );
}

export function RunOfService({
  renderAdd,
  fallbackSongs,
}: {
  /** The segment's "+", which only the screen knows how to fill. */
  renderAdd: (seg: RunSegment) => ReactNode;
  /** The fixture library, for "edit song" when there is no engine. */
  fallbackSongs?: readonly LibrarySong[];
}) {
  const run = useRun();
  const drag = useDrag();
  const [editing, setEditing] = useState<{ segKey: string; item: QueueItem; origin: HTMLElement | null } | null>(null);

  return (
    <>
      {run.segments.length === 0 ? (
        <EmptyMark
          w={220}
          h={220}
          plain
          art={<PopStackArt />}
          line="use + to build today’s run"
          below={<RunEmptyActions />}
        />
      ) : (
        /* The panel body clips; the list scrolls inside it, so a long service
           never pushes the cards out of reach under the panel's edge. */
        <ul className="flex h-full flex-col gap-[6px] overflow-y-auto px-1 py-1.5">
          {run.segments.map((seg, i) => (
            <SegmentCard
              key={seg.key}
              seg={seg}
              index={i}
              total={run.segments.length}
              over={drag.over === seg.key}
              dropProps={drag.dropProps(seg.key)}
              renderAdd={renderAdd}
              onEditSong={(segKey, item, origin) => setEditing({ segKey, item, origin })}
            />
          ))}
        </ul>
      )}

      {editing && (
        <RunSongEditor
          key={editing.item.key}
          item={editing.item}
          origin={editing.origin}
          fallbackSongs={fallbackSongs}
          onSaved={(patch) => run.patchItem(editing.segKey, editing.item.key, patch)}
          onClosed={() => setEditing(null)}
        />
      )}
    </>
  );
}
