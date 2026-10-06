import { useState } from 'react';
import { Panel } from '../parts';
import { Button, ChevronRightIcon, cx } from '../../../ui';
import { EmptyMark } from '../emptyArt';
import { PocketWatchArt } from '../PocketWatchArt';
import { Expandable } from './expand';
import { useLiveStore } from '../../../stores/liveStore';

/*
 * Sermon notes — the outline, and the two ways it leaves the building.
 *
 * This card used to draw an empty state under two dead buttons, with a
 * comment saying the doors were not open. They are now: the engine has had
 * working note generation and both exports the whole time
 * (electron/notes/sermonNotesGenerator.ts — generateSermonNotes,
 * exportSermonNotesPdf, exportSermonNotesMarkdown), reached over IPC. The
 * only thing missing was a caller on this side, and the old NOTES tab was
 * it. Wiring the card is what lets that tab go.
 *
 * Two sources, in order of preference:
 *
 *   generatedNotes   the LLM pass, run when the service ends. Better
 *                    prose, needs a transcript and a moment to think.
 *   notesSnapshot    the incremental outline the engine keeps DURING the
 *                    sermon. Rougher, but it exists before the sermon is
 *                    over, which is exactly when someone asks for it.
 *
 * Export takes whichever is available, preferring the generated one — so
 * pressing export mid-service gives you the running outline rather than an
 * error, which is the behaviour the old tab had and the one people expect.
 */

/** The live snapshot, in the shape the exporters take. */
function snapshotToNotes(snapshot: NotesSnapshot): SermonNotes {
  return {
    title: snapshot.title,
    theme: snapshot.theme,
    points: snapshot.currentPoints.map((p) => ({
      title: p.heading,
      content: p.explanation,
      scriptures: p.scriptures,
    })),
    definitions: snapshot.definitions,
    quotes: snapshot.quotes,
    applications: snapshot.applications,
  };
}

const MUTED = 'rgb(229 243 242 / 0.45)';
const INK_SOFT = 'rgb(229 243 242 / 0.82)';

/** Everything the card needs, in one place, so face and open view agree. */
function useNotes() {
  const notesSnapshot = useLiveStore((s) => s.notesSnapshot);
  const generatedNotes = useLiveStore((s) => s.generatedNotes);
  const setGeneratedNotes = useLiveStore((s) => s.setGeneratedNotes);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const exportable: SermonNotes | null =
    generatedNotes ?? (notesSnapshot ? snapshotToNotes(notesSnapshot) : null);

  const generate = async () => {
    setBusy(true);
    setNote(null);
    try {
      const notes = await window.api?.generateSermonNotes();
      if (notes) setGeneratedNotes(notes);
      else setNote('no notes came back — has a sermon been transcribed yet?');
    } catch {
      setNote('could not generate notes');
    } finally {
      setBusy(false);
    }
  };

  const exportAs = async (kind: 'pdf' | 'md') => {
    if (!exportable) return;
    setNote(null);
    try {
      const res =
        kind === 'pdf'
          ? await window.api?.exportSermonNotesPdf(exportable)
          : await window.api?.exportSermonNotesMd(exportable);
      /* The saved path is the useful half of the answer — "exported" on its
         own leaves an operator hunting through Documents for the file. */
      if (res?.success) setNote(res.path ? `saved — ${res.path}` : 'saved');
      else if (res?.error) setNote(res.error);
    } catch {
      setNote('export failed');
    }
  };

  return { notesSnapshot, generatedNotes, exportable, busy, note, generate, exportAs };
}

export function SermonNotesTile({ className }: { className?: string }) {
  return (
    <Expandable
      className={className}
      title="Sermon notes"
      glyph={false}
      blurb="The outline the engine builds while the sermon is preached."
      size={{ w: 700, h: 640 }}
      tile={({ onOpen }) => <NotesFace onOpen={onOpen} />}
    >
      <NotesOpen />
    </Expandable>
  );
}

/* ------------------------------------------------------------------ */
/* The open view — the outline at reading size                         */
/* ------------------------------------------------------------------ */

function NotesOpen() {
  const { notesSnapshot, generatedNotes, exportable, busy, note, generate, exportAs } = useNotes();
  const notes = generatedNotes ?? (notesSnapshot ? snapshotToNotes(notesSnapshot) : null);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-2">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {notes ? (
          <Outline notes={notes} live={!generatedNotes} />
        ) : (
          <EmptyMark
            art={<PocketWatchArt />}
            w={170}
            h={170}
            plain
            play="hover"
            line="no outline yet"
            hint="the engine writes it as the sermon is preached"
          />
        )}
      </div>
      <Actions
        busy={busy}
        note={note}
        canExport={!!exportable}
        onGenerate={generate}
        onExport={exportAs}
      />
    </div>
  );
}

/*
 * One outline renderer for both states.
 *
 * The old tab drew the live snapshot and the generated document twice over,
 * in two components with different type shapes. They are the same document
 * at two stages of polish, so this draws one and says which it is — the
 * difference the operator cares about is "is this still being written",
 * which is a line of text, not a different layout.
 */
function Outline({ notes, live }: { notes: SermonNotes; live: boolean }) {
  return (
    <article className="flex flex-col gap-5 pb-2">
      <header className="flex flex-col gap-1">
        {notes.title && (
          <h3 className="text-[19px] font-semibold text-[var(--tri-ink)]">{notes.title}</h3>
        )}
        <p className="text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: MUTED }}>
          {notes.theme ? `${notes.theme} · ` : ''}
          {live ? 'still being written' : 'generated'}
        </p>
      </header>

      {notes.points && notes.points.length > 0 && (
        <ol className="flex flex-col gap-4">
          {notes.points.map((point, i) => (
            <li key={i} className="flex flex-col gap-1.5">
              <p className="text-[length:var(--tri-size)] font-semibold text-[var(--tri-ink)]">
                {i + 1}. {point.title}
              </p>
              {point.scriptures && point.scriptures.length > 0 && (
                <p className="text-[length:var(--tri-size-xs)]" style={{ color: '#8fd3c0' }}>
                  {point.scriptures.join(' · ')}
                </p>
              )}
              {point.content && (
                <p
                  className="text-[length:var(--tri-size-xs)] leading-relaxed"
                  style={{ color: INK_SOFT }}
                >
                  {point.content}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      <Section title="terms" show={!!notes.definitions?.length}>
        {notes.definitions?.map((d) => (
          <p key={d.term} className="text-[length:var(--tri-size-xs)]" style={{ color: INK_SOFT }}>
            <span className="font-semibold text-[var(--tri-ink)]">{d.term}</span> — {d.definition}
          </p>
        ))}
      </Section>

      <Section title="applications" show={!!notes.applications?.length}>
        {notes.applications?.map((a, i) => (
          <p
            key={i}
            className="text-[length:var(--tri-size-xs)] leading-relaxed"
            style={{ color: INK_SOFT }}
          >
            — {a}
          </p>
        ))}
      </Section>

      <Section title="quotes" show={!!notes.quotes?.length}>
        {notes.quotes?.map((q, i) => (
          <p
            key={i}
            className="text-[length:var(--tri-size-xs)] italic leading-relaxed"
            style={{ color: INK_SOFT }}
          >
            “{q}”
          </p>
        ))}
      </Section>
    </article>
  );
}

function Section({
  title,
  show,
  children,
}: {
  title: string;
  show: boolean;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <section className="flex flex-col gap-1.5 border-t border-white/[0.07] pt-3">
      <span
        className="text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em]"
        style={{ color: MUTED }}
      >
        {title}
      </span>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Actions — generate, and the two exports                             */
/* ------------------------------------------------------------------ */

/*
 * Export is two buttons, not one with a menu.
 *
 * Markdown and PDF are not variants of one act — they go to different
 * people. The PDF is what gets printed for the pulpit or mailed to someone
 * who was not there; the markdown is what goes into whatever the church
 * writes in. Hiding either behind a menu costs a press on the busiest
 * screen of the week, and there are only two of them.
 */
function Actions({
  busy,
  note,
  canExport,
  onGenerate,
  onExport,
  compact,
}: {
  busy: boolean;
  note: string | null;
  canExport: boolean;
  onGenerate: () => Promise<void>;
  onExport: (kind: 'pdf' | 'md') => Promise<void>;
  compact?: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <div className="flex gap-2">
        <Button
          label={busy ? 'generating…' : 'generate'}
          disabled={busy}
          onClick={() => void onGenerate()}
          className="flex-1"
        />
        <Button
          label={compact ? 'pdf' : 'export pdf'}
          disabled={!canExport}
          onClick={() => void onExport('pdf')}
          className="flex-1"
        />
        <Button
          label={compact ? 'markdown' : 'export markdown'}
          disabled={!canExport}
          onClick={() => void onExport('md')}
          className="flex-1"
        />
      </div>
      {note && (
        <p
          className={cx('truncate text-[length:var(--tri-size-eyebrow)] lowercase')}
          style={{ color: MUTED }}
          title={note}
        >
          {note}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The face                                                            */
/* ------------------------------------------------------------------ */

function NotesFace({ onOpen }: { onOpen: () => void }) {
  const { notesSnapshot, generatedNotes, exportable, busy, note, generate, exportAs } = useNotes();
  const notes = generatedNotes ?? (notesSnapshot ? snapshotToNotes(notesSnapshot) : null);
  const points = notes?.points?.length ?? 0;

  if (!notes) return <NotesEmpty onOpen={onOpen} />;

  return (
    <Panel
      title="sermon notes"
      onOpen={onOpen}
      className="min-h-0 w-full flex-1"
      bodyClass="pt-1"
      right={
        notes ? (
          <span
            className="inline-flex items-center gap-1 text-[length:var(--tri-size-eyebrow)] lowercase tabular-nums"
            style={{ color: MUTED }}
          >
            {points} {points === 1 ? 'point' : 'points'} <ChevronRightIcon size={10} />
          </span>
        ) : undefined
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="min-h-0 flex-1 overflow-hidden">
          {notes ? (
            /* The face shows the top of the outline, not all of it: the
               card is a glance, and the press is right there. */
            <div
              role="button"
              tabIndex={0}
              onClick={onOpen}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen();
                }
              }}
              className="flex cursor-pointer flex-col gap-1.5 text-left outline-none"
            >
              {notes.title && (
                <p className="truncate text-[15px] font-semibold text-[var(--tri-ink)]">
                  {notes.title}
                </p>
              )}
              {notes.points?.slice(0, 3).map((p, i) => (
                <p
                  key={i}
                  className="truncate text-[length:var(--tri-size-xs)]"
                  style={{ color: INK_SOFT }}
                >
                  {i + 1}. {p.title}
                </p>
              ))}
              {points > 3 && (
                <p className="text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: MUTED }}>
                  +{points - 3} more
                </p>
              )}
            </div>
          ) : (
            <EmptyMark
              art={<PocketWatchArt />}
              w={170}
              h={170}
              plain
              play="hover"
              line="no outline yet"
              hint="built as the sermon is preached"
            />
          )}
        </div>
        {/* Its own press: the card opens either way, but these act without
            opening it — exporting is one button, not a journey. */}
        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Actions
            compact
            busy={busy}
            note={note}
            canExport={!!exportable}
            onGenerate={generate}
            onExport={exportAs}
          />
        </span>
      </div>
    </Panel>
  );
}

/** Empty notes keep their description beneath the clock. */
function NotesEmpty({ onOpen }: { onOpen: () => void }) {
  return (
    <Panel empty title="sermon notes" className="min-h-0 w-full flex-1">
      <EmptyMark plain art={<PocketWatchArt />} w={180} h={170}
        line="points, scriptures and quotes"
        hint="appear here as the sermon is preached"
        below={<Button label="open sermon notes" onClick={onOpen} />} />
    </Panel>
  );
}
