/**
 * Presentational sermon-notes sections, extracted from the live NotesTab so
 * the archive detail page renders notes identically. No "use client" — this
 * is pure markup, usable from both server and client components.
 *
 * Renders a fragment; the caller supplies the spacing container (space-y-6).
 */

export interface MainPoint {
  point: string;
  explanation: string;
  scriptures: string[];
}

export interface SermonNotesData {
  title: string | null;
  theme: string | null;
  main_points: MainPoint[] | null;
  definitions: { term: string; definition: string }[] | null;
  applications: string[] | null;
  memorable_quotes: string[] | null;
  all_scriptures: string[] | null;
  is_live: boolean | null;
}

export function notesAreEmpty(notes: SermonNotesData): boolean {
  return (
    !notes.title && !notes.theme && (notes.main_points?.length ?? 0) === 0
  );
}

export default function SermonNotesSections({
  notes,
}: {
  notes: SermonNotesData;
}) {
  const mainPoints = notes.main_points ?? [];
  const applications = notes.applications ?? [];
  const quotes = notes.memorable_quotes ?? [];
  const definitions = notes.definitions ?? [];

  return (
    <>
      {notes.title && (
        <header>
          <h2 className="text-2xl font-bold text-white">{notes.title}</h2>
          {notes.theme && (
            <p className="text-sm text-gray-400 mt-1">{notes.theme}</p>
          )}
          {notes.is_live && (
            <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-brand/15 border border-brand/30 text-brand text-[10px] font-semibold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-brand live-dot" />
              Building live
            </span>
          )}
        </header>
      )}

      {mainPoints.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">
            Main points
          </h3>
          <ol className="space-y-4">
            {mainPoints.map((p, i) => (
              <li key={i} className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
                <p className="text-sm font-semibold text-white mb-1.5">
                  <span className="text-brand mr-2">{i + 1}.</span>
                  {p.point}
                </p>
                {p.explanation && (
                  <p className="text-sm text-gray-400 leading-relaxed mb-2">
                    {p.explanation}
                  </p>
                )}
                {p.scriptures?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.scriptures.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-[10px] font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {applications.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">
            Apply this week
          </h3>
          <ul className="space-y-2">
            {applications.map((a, i) => (
              <li key={i} className="text-sm text-gray-300 leading-relaxed">
                — {a}
              </li>
            ))}
          </ul>
        </section>
      )}

      {quotes.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">
            Quotes
          </h3>
          <ul className="space-y-3">
            {quotes.map((q, i) => (
              <li
                key={i}
                className="rounded-lg bg-white/[0.02] border-l-2 border-brand pl-3 py-2 text-sm italic text-gray-300"
              >
                &ldquo;{q}&rdquo;
              </li>
            ))}
          </ul>
        </section>
      )}

      {definitions.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">
            Defined
          </h3>
          <dl className="space-y-2">
            {definitions.map((d, i) => (
              <div key={i}>
                <dt className="text-sm font-semibold text-white">{d.term}</dt>
                <dd className="text-sm text-gray-400">{d.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}
