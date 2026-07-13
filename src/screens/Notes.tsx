import { useState } from 'react';
import { useLiveStore } from '../stores/liveStore';
import { TextButton, SectionLabel, EngineNote, hasEngine } from '../components/ui';

/** Convert the live incremental snapshot into the exportable notes shape. */
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

function LiveOutline({ snapshot }: { snapshot: NotesSnapshot }) {
  return (
    <div className="space-y-4">
      {snapshot.title && <p className="font-scripture text-2xl">{snapshot.title}</p>}
      {snapshot.theme && <p className="text-sm text-neutral-500">theme · {snapshot.theme}</p>}
      <ol className="space-y-3">
        {snapshot.currentPoints.map((point, i) => (
          <li key={i} className="space-y-1">
            <p className="font-medium">
              {i + 1}. {point.heading}
            </p>
            {point.explanation && (
              <p className="pl-5 text-sm leading-relaxed text-neutral-600">{point.explanation}</p>
            )}
            {point.scriptures.length > 0 && (
              <p className="pl-5 font-scripture text-sm text-neutral-500">
                {point.scriptures.join(' · ')}
              </p>
            )}
          </li>
        ))}
      </ol>
      {snapshot.definitions.length > 0 && (
        <div className="space-y-1 pl-5">
          {snapshot.definitions.map((d) => (
            <p key={d.term} className="text-sm text-neutral-600">
              <span className="font-medium text-ink">{d.term}</span> — {d.definition}
            </p>
          ))}
        </div>
      )}
      {snapshot.quotes.length > 0 && (
        <div className="space-y-1 pl-5">
          {snapshot.quotes.map((q, i) => (
            <p key={i} className="font-scripture text-sm italic text-neutral-600">“{q}”</p>
          ))}
        </div>
      )}
      {snapshot.applications.length > 0 && (
        <div className="space-y-1 pl-5">
          {snapshot.applications.map((a, i) => (
            <p key={i} className="text-sm text-neutral-600">— {a}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function NotesDocument({ notes }: { notes: SermonNotes }) {
  return (
    <article className="max-w-2xl space-y-8">
      <header className="space-y-2">
        {notes.title && <h2 className="font-scripture text-3xl">{notes.title}</h2>}
        {notes.theme && <p className="text-sm uppercase tracking-widest text-neutral-400">{notes.theme}</p>}
      </header>
      {notes.points && notes.points.length > 0 && (
        <ol className="space-y-6">
          {notes.points.map((point, i) => (
            <li key={i} className="space-y-2">
              <p className="text-lg font-medium">
                {i + 1}. {point.title}
              </p>
              {point.scriptures && point.scriptures.length > 0 && (
                <p className="font-scripture text-sm text-neutral-500">{point.scriptures.join(' · ')}</p>
              )}
              {point.content && <p className="leading-relaxed text-neutral-700">{point.content}</p>}
            </li>
          ))}
        </ol>
      )}
      {notes.definitions && notes.definitions.length > 0 && (
        <section className="space-y-2">
          <SectionLabel>terms</SectionLabel>
          {notes.definitions.map((d) => (
            <p key={d.term} className="text-sm">
              <span className="font-medium">{d.term}</span> — {d.definition}
            </p>
          ))}
        </section>
      )}
      {notes.applications && notes.applications.length > 0 && (
        <section className="space-y-2">
          <SectionLabel>applications</SectionLabel>
          {notes.applications.map((a, i) => (
            <p key={i} className="text-sm leading-relaxed">— {a}</p>
          ))}
        </section>
      )}
      {notes.quotes && notes.quotes.length > 0 && (
        <section className="space-y-2">
          <SectionLabel>quotes</SectionLabel>
          {notes.quotes.map((q, i) => (
            <p key={i} className="font-scripture italic leading-relaxed">“{q}”</p>
          ))}
        </section>
      )}
    </article>
  );
}

export function Notes() {
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
      else setNote('no notes came back — is a sermon transcript available?');
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
      if (res?.success) setNote(`exported${res.path ? ` — ${res.path}` : ''}`);
      else if (res?.error) setNote(res.error);
    } catch {
      setNote('export failed');
    }
  };

  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <SectionLabel>live outline</SectionLabel>
        {notesSnapshot ? (
          <LiveOutline snapshot={notesSnapshot} />
        ) : hasEngine() ? (
          <p className="text-sm italic text-neutral-400">
            the engine builds this outline while the sermon is preached
          </p>
        ) : (
          <EngineNote />
        )}
      </section>

      <section className="space-y-5 border-t border-hairline pt-10">
        <div className="flex flex-wrap items-baseline gap-x-10">
          <TextButton label="GENERATE NOTES" primary onClick={() => void generate()} disabled={!hasEngine() || busy} />
          <TextButton label="EXPORT PDF" onClick={() => void exportAs('pdf')} disabled={!hasEngine() || !exportable} />
          <TextButton label="EXPORT MARKDOWN" onClick={() => void exportAs('md')} disabled={!hasEngine() || !exportable} />
        </div>
        {busy && <p className="text-sm italic text-neutral-400">generating…</p>}
        {note && <p className="text-sm text-neutral-500">{note}</p>}
        {generatedNotes && <NotesDocument notes={generatedNotes} />}
      </section>
    </div>
  );
}
