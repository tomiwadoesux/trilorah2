import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  Button, cx, PlusIcon, CloseIcon, ArrowIcon, CheckIcon, WarningIcon, LoadingIcon, ChevronDownIcon, MicIcon, InfoIcon, UndoIcon,
} from '../../../ui';
import { Toggle } from '../settingsRows';
import { bookIdFromName } from '../../../lib/books';
import { BIBLE_SHELF, type PreacherTeaching } from '../../../../shared/preacherLearning';
import type { Preacher, SoundsLike } from './preachers';
import './teaching.css';

/*
 * Words and names — what the operator can TEACH a preacher's profile.
 *
 * The rest of the page is reading: how well it knows them, which books it
 * hears. This tab is the doing half — the places a person puts knowledge
 * INTO the engine, all of them real (electron/preachers/teaching.ts):
 *
 *   voice commands  whether this preacher's spoken commands move the screen
 *   book names      "rawmeans" is Romans. The recogniser is CONSISTENT about
 *                   what it gets wrong, so one row fixes every Sunday after
 *   names           names and church words the speech engine is told about
 *   after a verse   what they habitually add after a reference ("amen"), so
 *                   it stops being read as part of it
 *
 * It used to be four boxed panels inside the tab's own box, with 10px grey
 * lowercase sentences and inputs you could barely see. Now it is one card
 * laid out like a settings page: a label column that says what each thing
 * is for in a full sentence, and the control beside it — no box in a box.
 *
 * Every change saves as it is made. ProfileView disables the whole fieldset
 * while a save is in flight, because each patch sends a WHOLE list built
 * from the current props, and two quick adds would otherwise overwrite each
 * other. Two consequences shape the code below:
 *
 *   - the add fields keep what was typed until the new row actually shows
 *     up in the profile, so a save the engine refuses loses nothing; and
 *   - a disabled control drops focus, so after a save the caret is put back
 *     where it was (focusWhenEnabled) — otherwise every word added means a
 *     click back into the field.
 */

const LIMIT = 100;
const LONGEST = 120;
const SHOWN_ROWS = 8;
const SAVED = 'Saved on this computer.';

/** The engine's own normalising (teaching.ts `words`): what a row is keyed by. */
const norm = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean).join(' ');

const SHORT_NAMES = new Map(BIBLE_SHELF.map((b) => [b.short.toLowerCase(), b.book]));
const SPOKEN_NAMES: Record<string, string> = {
  psalm: 'Psalms', 'song of songs': 'Song of Solomon', songs: 'Song of Solomon', revelations: 'Revelation',
};
const ORDINALS: Record<string, string> = { first: '1', second: '2', third: '3', '1st': '1', '2nd': '2', '3rd': '3', i: '1', ii: '2', iii: '3' };

/**
 * The book a typed name means, spelled the way the engine stores it.
 *
 * Generous on purpose — "rom", "1 cor", "first john", "1john" and "Psalm"
 * all land on a book — because the field shows the name it will save
 * before it is saved, so what the volunteer sees is what they get.
 */
export function toBook(text: string): string | null {
  let q = text.trim().toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ');
  if (!q) return null;
  q = q.replace(/^(first|second|third|1st|2nd|3rd|iii|ii|i) /, (m) => `${ORDINALS[m.trim()]} `);
  q = q.replace(/^(\d)(?=[a-z])/, '$1 ');
  return SPOKEN_NAMES[q] ?? SHORT_NAMES.get(q) ?? bookIdFromName(q)?.name ?? null;
}

/**
 * Put focus back on a control once the saving fieldset lets go of it.
 *
 * Polls a frame at a time (at most a second) rather than trusting an
 * effect: the store updates while the fieldset is still disabled, and
 * focusing a disabled input silently does nothing. Leaves focus alone if
 * the person has already moved somewhere else.
 */
function focusWhenEnabled(get: () => HTMLElement | null | undefined, scope: () => HTMLElement | null) {
  let frames = 0;
  const tick = () => {
    const el = get();
    if (!el || !el.isConnected || el.matches(':disabled')) {
      if (++frames < 60) requestAnimationFrame(tick);
      return;
    }
    const active = document.activeElement;
    const root = scope();
    if (active && active !== document.body && active !== el && !(root && root.contains(active))) return;
    el.focus({ preventScroll: true });
  };
  requestAnimationFrame(tick);
}

const composing = (e: KeyboardEvent) => e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229;

/* ------------------------------------------------------------------ */
/* Save status (Panel header) and notices (top of the card body)        */
/* ------------------------------------------------------------------ */

/**
 * The save message when it is an error, otherwise null — without Electron's
 * "Error invoking remote method '…': Error:" wrapper, so a save the engine
 * refuses ("Finish voice training before changing book names.") reads as
 * the sentence the engine wrote.
 */
export function teachingSaveError(message: string): string | null {
  if (!message || message === 'Saving…' || message === SAVED) return null;
  return message.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, '') || message;
}

/**
 * Saving… / Saved / Not saved, in the card's header.
 *
 * "Saved" only shows for a save that finished while this tab was open, and
 * fades out after a few seconds: a permanent "Saved on this computer" at the
 * bottom of the card was noise the moment it had been read once.
 */
export function TeachingSaveStatus({ saving, message }: { saving: boolean; message: string }) {
  const [prevSaving, setPrevSaving] = useState(saving);
  const [stamp, setStamp] = useState(0);
  if (prevSaving !== saving) {
    setPrevSaving(saving);
    if (prevSaving && !saving && message === SAVED) setStamp(stamp + 1);
  }
  const error = teachingSaveError(message);
  let content: ReactNode = null;
  if (saving) {
    content = <span key="saving" className="wn-status"><LoadingIcon size={12} className="wn-spin" /><span className="wn-status-text">Saving…</span></span>;
  } else if (error) {
    /* The alert row in the body reads the full message; this is the glance. */
    content = <span key="error" className="wn-status wn-status--error" title={error} aria-hidden><WarningIcon size={12} /><span className="wn-status-text">Not saved</span></span>;
  } else if (stamp && message === SAVED) {
    content = <span key={`saved-${stamp}`} className="wn-status wn-status--saved" title={SAVED}><CheckIcon size={12} /><span className="wn-status-text">Saved on this computer</span></span>;
  }
  return <span role="status" className="wn-statusbox">{content}</span>;
}

/** The sample-profile note and the save error, above the sections. */
export function TeachingNotices({ sample, message }: { sample: boolean; message: string }) {
  const error = teachingSaveError(message);
  return <>
    {sample && <p className="wn-note"><InfoIcon size={13} />This is a sample profile. Open the desktop app to change what Trilorah has been taught.</p>}
    {error && <p role="alert" className="wn-note wn-note--error"><WarningIcon size={13} />{error}</p>}
  </>;
}

/* ------------------------------------------------------------------ */
/* Layout                                                               */
/* ------------------------------------------------------------------ */

function Section({ title, desc, meta, children }: { title: string; desc: ReactNode; meta?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section className="wn-sec" aria-labelledby={id}>
      <div className="wn-label">
        <h3 id={id}>{title}</h3>
        <p className="wn-desc">{desc}</p>
        {meta && <p className="wn-meta">{meta}</p>}
      </div>
      <div className="wn-body">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Book names it mishears                                               */
/* ------------------------------------------------------------------ */

type Hint = { field: 'heard' | 'means'; text: string };

/* Not "rawmeans → Romans": that pair is already the add fields' placeholder
   and the section's own sentence, so it would read three times over. */
const EXAMPLE_ROWS: [string, string][] = [['fill a pians', 'Philippians'], ['have a cook', 'Habakkuk']];

/** How long "Removed … undo" stays, counted only while Undo is not focused or pointed at. */
const UNDO_MS = 6000;

/*
 * A real table, read left to right the way the fix works: what came out of
 * the recogniser, an arrow, what it should be. The heard side is mono so it
 * reads as a machine's output rather than a word someone chose — it is
 * usually not a real word at all.
 *
 * The add row is the table's own first row, under the column names, so the
 * two fields are labelled by the same headings as the rows they create.
 */
function BookNames({ p, onChange }: { p: Preacher; onChange: (patch: Partial<PreacherTeaching>) => void }) {
  const rows = p.soundsLike;
  const [heard, setHeard] = useState('');
  const [means, setMeans] = useState('');
  const [hint, setHint] = useState<Hint | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  /* `restoring` once Undo has been pressed: the line stays until the row is
     actually back, so a save the engine refuses leaves Undo where it was. */
  const [removed, setRemoved] = useState<{ row: SoundsLike; index: number; restoring?: boolean } | null>(null);
  const [undoClock, setUndoClock] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);
  const heardRef = useRef<HTMLInputElement>(null);
  const meansRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const goneRef = useRef<HTMLLIElement>(null);
  const headHeard = useId();
  const headMeans = useId();
  const hintId = useId();

  const full = rows.length >= LIMIT;
  const guess = means.trim() ? toBook(means) : null;
  const showGuess = !!guess && guess.toLowerCase() !== means.trim().toLowerCase();

  /* The row has landed: now the fields can let go of what was typed. */
  useEffect(() => {
    if (!pending || !rows.some((r) => r.heard === pending)) return;
    setHeard(''); setMeans(''); setFresh(pending); setPending(null);
    focusWhenEnabled(() => heardRef.current, () => tableRef.current);
  }, [rows, pending]);
  useEffect(() => { if (!fresh) return; const t = window.setTimeout(() => setFresh(null), 1600); return () => window.clearTimeout(t); }, [fresh]);
  useEffect(() => { if (!flash) return; const t = window.setTimeout(() => setFlash(null), 900); return () => window.clearTimeout(t); }, [flash]);
  /* "Removed … undo" never disappears from under the caret or the pointer:
     the clock only runs while Undo is neither focused nor pointed at, and
     leaving it (blur, pointer out) starts the six seconds again. */
  useEffect(() => {
    if (!removed) return;
    const t = window.setTimeout(() => {
      if (undoRef.current && (undoRef.current === document.activeElement || goneRef.current?.matches(':hover'))) return;
      setRemoved(null);
    }, UNDO_MS);
    return () => window.clearTimeout(t);
  }, [removed, undoClock]);
  /* An undo has landed: the row is back, so the line can go. */
  useEffect(() => {
    if (!removed?.restoring || !rows.some((r) => r.heard === removed.row.heard)) return;
    setFresh(removed.row.heard);
    setRemoved(null);
  }, [rows, removed]);

  /** A row's own ✕, found by what it hears. */
  const xFor = (h: string) =>
    Array.from(tableRef.current?.querySelectorAll<HTMLElement>('.wn-x') ?? []).find((b) => b.dataset.heard === h) ?? null;

  const fail = (field: Hint['field'], text: string) => {
    setHint({ field, text });
    (field === 'heard' ? heardRef : meansRef).current?.focus();
  };

  /* The same rules the engine applies (teaching.ts validateTeaching), checked
     here first so a refusal is a sentence beside the field, not a lost row. */
  const commit = () => {
    const h = heard.trim();
    const m = means.trim();
    if (!h) return fail('heard', 'Type what the microphone wrote, like rawmeans.');
    if (!m) return fail('means', 'Type the book it should be, like Romans.');
    const key = norm(h);
    if (!key) return fail('heard', 'Use the letters it wrote, like rawmeans.');
    if (h.length > LONGEST) return fail('heard', `Keep it under ${LONGEST} letters.`);
    const book = toBook(m);
    if (!book) return fail('means', `“${m}” isn’t a book of the Bible. Try one like Romans or 1 John.`);
    const at = rows.findIndex((r) => norm(r.heard) === key);
    if (at >= 0) {
      if (at >= SHOWN_ROWS) setExpanded(true);
      setFlash(rows[at].heard);
      return fail('heard', `“${key}” is already in the list as ${rows[at].means}. Remove it first to change it.`);
    }
    if (key === norm(book)) return fail('heard', 'That’s already how the book is spelled, so there’s nothing to fix.');
    if (full) return fail('heard', `That’s the most it can keep (${LIMIT}). Remove one to add another.`);
    setHint(null);
    setMeans(book);
    setPending(key);
    /* Saving disables the fields. If the engine refuses the row, what was
       typed stays and the caret goes back to the field it was in; if the
       row lands, the effect above moves it on to an empty "It hears". */
    const back = document.activeElement === meansRef.current ? meansRef : heardRef;
    onChange({ soundsLike: [{ heard: h, means: book, source: 'taught', hits: 0 }, ...rows] });
    focusWhenEnabled(() => back.current, () => tableRef.current);
  };

  const clear = () => { setHeard(''); setMeans(''); setHint(null); setPending(null); };

  const remove = (row: SoundsLike, index: number, viaKeyboard: boolean) => {
    onChange({ soundsLike: rows.filter((r) => r !== row) });
    setRemoved({ row, index });
    /* Onto Undo once the row has gone; if the engine refused, back to the row's own ✕. */
    if (viaKeyboard) focusWhenEnabled(() => undoRef.current ?? xFor(row.heard), () => tableRef.current);
  };

  /* Back where it was, with its source: a learned row stays learned. */
  const undo = () => {
    if (!removed) return;
    const { row, index } = removed;
    if (rows.some((r) => r.heard === row.heard)) { setRemoved(null); return; }
    setRemoved({ row, index, restoring: true });
    onChange({ soundsLike: [...rows.slice(0, index), row, ...rows.slice(index)] });
    /* Undo goes once the row is back, so the caret moves to that row's ✕;
       if the engine refused, Undo is still there and keeps it. */
    focusWhenEnabled(() => xFor(row.heard) ?? undoRef.current ?? heardRef.current, () => tableRef.current);
  };

  type Item = { kind: 'row'; row: SoundsLike; index: number } | { kind: 'gone'; row: SoundsLike };
  const items: Item[] = rows.map((row, index) => ({ kind: 'row' as const, row, index }));
  if (removed && !rows.some((r) => r.heard === removed.row.heard)) {
    items.splice(Math.min(removed.index, items.length), 0, { kind: 'gone', row: removed.row });
  }
  const overflow = items.length > SHOWN_ROWS;
  const visible = overflow && !expanded ? items.slice(0, SHOWN_ROWS) : items;

  const onHeardKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (composing(e)) return;
    if (e.key === 'Enter') { e.preventDefault(); if (heard.trim() && !means.trim()) meansRef.current?.focus(); else commit(); }
    if (e.key === 'Escape' && (heard || means || hint)) { e.preventDefault(); clear(); }
  };
  const onMeansKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (composing(e)) return;
    if (e.key === 'Enter') { e.preventDefault(); if (means.trim() && !heard.trim()) heardRef.current?.focus(); else commit(); }
    if (e.key === 'Escape' && (heard || means || hint)) { e.preventDefault(); clear(); }
    /* Tab takes the name the field is suggesting; the next Tab moves on. */
    if (e.key === 'Tab' && !e.shiftKey && showGuess && guess) { e.preventDefault(); setMeans(guess); }
  };

  const invalid = (field: Hint['field']) => (hint?.field === field ? true : undefined);

  return (
    <div className="wn-table" ref={tableRef}>
      <div className="wn-cols wn-head">
        <span id={headHeard}>It hears</span>
        <span aria-hidden />
        <span id={headMeans}>It should be</span>
        <span />
        <span />
      </div>

      <div className="wn-addrow">
        <div className="wn-cols">
          <input
            ref={heardRef}
            data-guide="teaching-heard"
            className="wn-field wn-field--mono"
            aria-labelledby={headHeard}
            aria-invalid={invalid('heard')}
            aria-describedby={hint?.field === 'heard' ? hintId : undefined}
            value={heard}
            maxLength={LONGEST}
            disabled={full}
            spellCheck={false}
            autoComplete="off"
            placeholder="rawmeans"
            onChange={(e) => { setHeard(e.target.value); setHint(null); setPending(null); }}
            onKeyDown={onHeardKey}
          />
          <span className="wn-arrow" aria-hidden><ArrowIcon size={11} /></span>
          <span className="wn-fieldwrap">
            <input
              ref={meansRef}
              data-guide="teaching-means"
              className={cx('wn-field', showGuess && 'wn-field--guess')}
              aria-labelledby={headMeans}
              aria-invalid={invalid('means')}
              aria-describedby={hint?.field === 'means' ? hintId : undefined}
              value={means}
              disabled={full}
              spellCheck={false}
              autoComplete="off"
              placeholder="Romans"
              onChange={(e) => { setMeans(e.target.value); setHint(null); setPending(null); }}
              onKeyDown={onMeansKey}
            />
            {showGuess && <span key={guess} className="wn-guess" aria-hidden>{guess}<kbd>tab</kbd></span>}
          </span>
          <span className="wn-addbtn">
            <Button guideId="teaching-sounds-like-add" icon={<PlusIcon size={11} />} label="add"
              disabled={!heard.trim() || !means.trim() || full} onClick={commit} />
          </span>
        </div>
        {hint ? <p id={hintId} role="alert" className="wn-hint"><WarningIcon size={12} />{hint.text}</p>
          : full && <p className="wn-hint wn-hint--info"><InfoIcon size={12} />That’s the most it can keep ({LIMIT}). Remove one to add another.</p>}
      </div>

      {items.length ? (
        <ul className="wn-rows" aria-label="Book names it mishears">
          {visible.map((it) => it.kind === 'gone' ? (
            <li key="gone" ref={goneRef} className="wn-gone" onPointerLeave={() => setUndoClock((n) => n + 1)}>
              <span className="min-w-0 truncate">Removed <b>{it.row.heard} → {it.row.means}</b>.</span>
              <button ref={undoRef} type="button" className="wn-undo" data-guide="teaching-undo" onClick={undo}
                onBlur={() => setUndoClock((n) => n + 1)}>
                <UndoIcon size={12} />undo
              </button>
            </li>
          ) : (
            <li key={`${it.row.heard}→${it.row.means}`}
              className={cx('wn-cols wn-row', (fresh === it.row.heard || pending === it.row.heard) && 'wn-row--new', flash === it.row.heard && 'wn-row--flash')}>
              <span className="wn-heard" title={it.row.heard}>{it.row.heard}</span>
              <span className="wn-arrow"><ArrowIcon size={11} /><span className="sr-only">means</span></span>
              <span className="wn-means" title={it.row.means}>{it.row.means}</span>
              <span className="min-w-0">
                {it.row.source === 'learned' && <span className="wn-tag" title="Voice training worked this out">
                  <MicIcon size={11} /><span>from training</span>
                </span>}
              </span>
              <button type="button" className="wn-x" data-guide="teaching-forget" data-heard={it.row.heard}
                aria-label={`Remove “${it.row.heard}”, which means ${it.row.means}`}
                onClick={(e) => remove(it.row, it.index, e.detail === 0)}>
                <CloseIcon size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : <>
        <ul className="wn-rows" aria-hidden>
          {EXAMPLE_ROWS.map(([h, m]) => (
            <li key={h} className="wn-cols wn-row wn-row--eg">
              <span className="wn-heard">{h}</span>
              <span className="wn-arrow"><ArrowIcon size={11} /></span>
              <span className="wn-means">{m}</span>
              <span><span className="wn-tag wn-tag--eg">example</span></span>
              <span />
            </li>
          ))}
        </ul>
        <p className="wn-empty">Nothing saved yet. Voice training adds a row here by itself whenever it learns how {p.name} says a book.</p>
      </>}

      {overflow && (
        <button type="button" className="wn-more" data-guide="teaching-show-all" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          <ChevronDownIcon size={12} />{expanded ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Names and church words / Words after a verse                         */
/* ------------------------------------------------------------------ */

function ChipGroup({
  values, onChange, placeholder, ariaLabel, listLabel, guideId, examples, suggestions,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  ariaLabel: string;
  listLabel: string;
  guideId: string;
  /** Shown, dashed and inert, while the list is empty. */
  examples?: string[];
  /** Common ones offered as one-press adds, until each has been added. */
  suggestions?: string[];
}) {
  const [text, setText] = useState('');
  const [hint, setHint] = useState('');
  const [pending, setPending] = useState<{ values: string[]; fromField: boolean } | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const hintId = useId();
  const lower = new Set(values.map((v) => v.toLowerCase()));
  const full = values.length >= LIMIT;

  useEffect(() => {
    if (!pending || !pending.values.every((v) => values.includes(v))) return;
    if (pending.fromField) {
      setText('');
      focusWhenEnabled(() => inputRef.current, () => boxRef.current);
    }
    setFresh(new Set(pending.values));
    setPending(null);
  }, [values, pending]);
  useEffect(() => { if (!fresh.size) return; const t = window.setTimeout(() => setFresh(new Set()), 1200); return () => window.clearTimeout(t); }, [fresh]);
  useEffect(() => { if (!flash) return; const t = window.setTimeout(() => setFlash(null), 900); return () => window.clearTimeout(t); }, [flash]);

  /* Commas and new lines split, so a pasted list arrives as separate chips. */
  const commit = () => {
    const parts = text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    if (parts.some((s) => s.length > LONGEST)) { setHint(`Keep each one under ${LONGEST} letters.`); return; }
    const seen = new Set(lower);
    const added: string[] = [];
    for (const s of parts) if (!seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); added.push(s); }
    if (!added.length) {
      setFlash(values.find((v) => v.toLowerCase() === parts[0].toLowerCase()) ?? null);
      setHint(parts.length === 1 ? 'Already in the list.' : 'All of those are already in the list.');
      return;
    }
    if (values.length + added.length > LIMIT) { setHint(`That’s the most it can keep (${LIMIT}). Remove one to add another.`); return; }
    setHint('');
    setPending({ values: added, fromField: true });
    onChange([...values, ...added]);
  };

  const remaining = suggestions?.filter((s) => !lower.has(s.toLowerCase())) ?? [];
  const suggestLabel = (s: string) => `Add “${s}”`;
  const suggestion = (s: string | undefined) =>
    s === undefined ? null
      : Array.from(boxRef.current?.querySelectorAll<HTMLElement>('.wn-suggest') ?? []).find((b) => b.getAttribute('aria-label') === suggestLabel(s)) ?? null;

  const suggest = (s: string) => {
    if (lower.has(s.toLowerCase()) || full) return;
    const at = remaining.indexOf(s);
    const next = remaining[at + 1] ?? remaining[at - 1];
    setPending({ values: [s], fromField: false });
    onChange([...values, s]);
    /* The pressed one leaves the list once it is saved, and saving disables
       it: the caret walks on to its neighbour, or back to the field when
       none are left. A refused save leaves it on the one pressed. */
    focusWhenEnabled(() => suggestion(s) ?? suggestion(next) ?? inputRef.current, () => boxRef.current);
  };

  const remove = (v: string, index: number, viaKeyboard: boolean) => {
    onChange(values.filter((x) => x !== v));
    /* Keyboard removal walks on to the next chip, then back to the field. */
    if (viaKeyboard) {
      focusWhenEnabled(() => {
        const buttons = listRef.current?.querySelectorAll<HTMLElement>('.wn-chip-x');
        return (buttons && buttons.length ? buttons[Math.min(index, buttons.length - 1)] : null) ?? inputRef.current;
      }, () => boxRef.current);
    }
  };

  return (
    <div className={cx('wn-box', hint && 'wn-box--invalid')} ref={boxRef}>
      <div className="wn-boxtop">
        <div className="wn-boxadd">
          <input
            ref={inputRef}
            data-guide={guideId}
            className="wn-boxinput"
            aria-label={ariaLabel}
            aria-invalid={hint ? true : undefined}
            aria-describedby={hint ? hintId : undefined}
            value={text}
            disabled={full}
            autoComplete="off"
            placeholder={placeholder}
            onChange={(e) => { setText(e.target.value); setHint(''); }}
            onKeyDown={(e) => {
              if (composing(e)) return;
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape' && (text || hint)) { e.preventDefault(); setText(''); setHint(''); }
            }}
          />
          <Button guideId={`${guideId}-add`} icon={<PlusIcon size={11} />} label="add" disabled={!text.trim() || full} onClick={commit} />
        </div>
        {hint && <p id={hintId} role="alert" className="wn-hint wn-hint--box"><WarningIcon size={12} />{hint}</p>}
      </div>

      <div className="wn-chips">
        {values.length ? (
          <ul ref={listRef} className="wn-chiplist" aria-label={listLabel}>
            {values.map((v, i) => (
              <li key={v} className={cx('wn-chip', (fresh.has(v) || pending?.values.includes(v)) && 'wn-chip--new', flash === v && 'wn-chip--flash')}>
                <span title={v}>{v}</span>
                <button type="button" className="wn-chip-x" data-guide="teaching-remove" aria-label={`Remove ${v}`}
                  onClick={(e) => remove(v, i, e.detail === 0)}>
                  <CloseIcon size={11} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wn-none">
            <span>{examples ? 'Nothing added yet. For example:' : 'Nothing added yet.'}</span>
            {examples?.map((e) => <span key={e} className="wn-chip wn-chip--eg" aria-hidden>{e}</span>)}
          </p>
        )}
      </div>

      {remaining.length > 0 && (
        <div className="wn-suggestions">
          <span className="wn-eyebrow">Common ones</span>
          {remaining.map((s) => (
            <button key={s} type="button" className="wn-suggest" data-guide="teaching-tail-suggestion" disabled={full}
              aria-label={suggestLabel(s)} onClick={() => suggest(s)}>
              <PlusIcon size={11} />{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const NAME_EXAMPLES = ['Pastor Ade', 'Bethel House', 'Deaconess Grace', 'Ebenezer'];
const TAIL_SUGGESTIONS = ['amen', 'are you with me', 'say it with me', 'can I get an amen', 'turn to your neighbour'];

export function TeachingPanels({
  p,
  onChange,
}: {
  p: Preacher;
  onChange: (patch: Partial<PreacherTeaching>) => void;
}) {
  const voiceOn = p.voiceCommands !== false;
  const learned = p.soundsLike.filter((r) => r.source === 'learned').length;
  const count = (n: number) => (n ? `${n} saved` : undefined);
  const switchRef = useRef<HTMLLabelElement>(null);
  /* Saving disables the switch, which drops focus; give it back afterwards. */
  const setVoice = (next: boolean) => {
    onChange({ voiceCommands: next });
    focusWhenEnabled(() => switchRef.current?.querySelector<HTMLElement>('[role="switch"]'), () => switchRef.current);
  };

  return (
    <div className="wn-secs">
      {/* For this preacher only. The app-wide switch is on the dashboard
          tile, because that is the one an operator stabs at when a command
          misfires mid-sermon; this one is set once, before they preach. */}
      <Section
        title="Voice commands"
        desc={<>Phrases like “next verse” and “clear the screen” can move the screen. The full list of phrases is on the dashboard.</>}
      >
        {/* The label wraps the switch, so the words press it too, and give
            it its name; on or off is the switch's own checked state. */}
        <label ref={switchRef} className="wn-switch" data-guide="teaching-voice-commands">
          <Toggle on={voiceOn} onChange={setVoice} />
          <span className="wn-switch-text">
            <b>Follow {p.name}’s voice commands</b>
            <span key={String(voiceOn)} className="wn-switch-state" aria-hidden>
              {voiceOn
                ? 'On. Switch this off for a guest whose words keep moving the screen by accident.'
                : 'Off. Their verses still come up; their commands are ignored.'}
            </span>
          </span>
        </label>
      </Section>

      <Section
        title="Book names it mishears"
        desc={<>When the microphone writes “rawmeans”, Trilorah reads Romans. A row only counts before a chapter or verse number, so everyday speech is left alone.</>}
        meta={p.soundsLike.length ? <>{p.soundsLike.length} saved{learned ? <> · <b>{learned} from voice training</b></> : null}</> : undefined}
      >
        <BookNames p={p} onChange={onChange} />
      </Section>

      <Section
        title="Names and church words"
        desc={`Names, places and words ${p.name} uses that a microphone might not know. Trilorah listens out for them so they come through right.`}
        meta={count(p.vocabulary.length)}
      >
        <ChipGroup
          values={p.vocabulary}
          onChange={(next) => onChange({ vocabulary: next })}
          guideId="profile-vocabulary"
          placeholder="Add a name, a place or a word"
          ariaLabel="Add a name or church word"
          listLabel="Names and church words"
          examples={NAME_EXAMPLES}
        />
      </Section>

      <Section
        title="Words after a verse"
        desc={<>What {p.name} tends to say straight after a reference. Trilorah drops it, so “Romans 8:28, say it with me” still reads as Romans 8:28.</>}
        meta={count(p.ignoreTails.length)}
      >
        <ChipGroup
          values={p.ignoreTails}
          onChange={(next) => onChange({ ignoreTails: next })}
          guideId="profile-ignored-tail"
          placeholder="Add a phrase, like “are you with me”"
          ariaLabel="Add words they say after a verse"
          listLabel="Words after a verse"
          suggestions={TAIL_SUGGESTIONS}
        />
      </Section>
    </div>
  );
}
