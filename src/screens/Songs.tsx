import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  EmptyState,
  EngineNote,
  Field,
  Panel,
  PanelHeader,
  Pill,
  SectionLabel,
  TextButton,
  hasEngine,
} from '../components/ui';

/**
 * Songs: the church's lyrics library, backed by the engine's song store
 * (<userData>/songs.json, seeded with public-domain hymns on first run).
 *
 * Two jobs. The first is getting words INTO the library, which is why the
 * import affordances sit above the library rather than below it: a church
 * arrives with a folder of SongSelect exports, not with an afternoon to type.
 * Three ways in, all landing on the same parse → review → commit path —
 * the native file picker, a paste box, and dropping files anywhere on the
 * screen. The second job is "set as current", which tells the engine which
 * song is live so the worship agent knows to hold a clean background.
 *
 * COPYRIGHT: nothing here fetches lyrics. The only words that reach this
 * screen are the ones the church imports from its own licensed files and the
 * public-domain hymns seeded by electron/songs/seed.ts.
 */

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Sections → the flat lyrics string the engine's worship logic still speaks.
 *
 * setCurrentSongLyrics predates sections and wants one blob with a blank line
 * between stanzas. This is LOSSY and deliberately so: the labels are dropped,
 * so feeding the result back through the plain-text parser renames Chorus to
 * Verse 2 and promotes the first lyric line to the title. Do not treat it as
 * a serialisation — the engine's only consumer ignores the text entirely and
 * uses the call as a signal that a song went live. If something ever does
 * need to read words back out, emit the label line before each stanza (the
 * parser's LABEL_LINE would read it) rather than reusing this.
 */
function flattenLyrics(sections: readonly SongSection[]): string {
  return sections.map((s) => s.lines.join('\n')).join('\n\n');
}

/** A one-line summary of a parse: "4 sections · 16 lines". */
function shapeOf(song: { sections: readonly SongSection[] }): string {
  const lines = song.sections.reduce((n, s) => n + s.lines.length, 0);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return `${plural(song.sections.length, 'section')} · ${plural(lines, 'line')}`;
}

/** Title, authors and CCLI as one credit line — whichever of them exist. */
function creditOf(song: { authors?: string[]; ccliNumber?: string }): string {
  const bits: string[] = [];
  if (song.authors?.length) bits.push(song.authors.join(', '));
  if (song.ccliNumber) bits.push(`CCLI ${song.ccliNumber}`);
  return bits.join(' · ');
}

/**
 * The legacy localStorage library, read once and only once.
 *
 * A pilot church may have typed songs into the old screen, which kept
 * `{ id, title, lyrics }` in localStorage with no sections at all. Those get
 * run through the plain-text parser so their stanzas become sections, then
 * imported and the key cleared. Losing songs a church typed by hand would be
 * unforgivable, so the key is cleared only after the commit resolves.
 */
const LEGACY_KEY = 'trilorah-songs';

/**
 * Module-level, and set synchronously before the first await in the effect.
 *
 * StrictMode mounts the screen, tears it down and mounts it again, and React
 * does not wait for the first effect's async body to finish. Both runs read
 * localStorage, both see the same songs, and both commit them — because the
 * key is only cleared once a commit has resolved. A pilot church with forty
 * hand-typed songs opened the Songs tab once and got eighty rows plus a
 * forty-group duplicate report, and since imports never overwrite by design,
 * nothing afterwards would have merged them back.
 *
 * The effect's `cancelled` flag cannot help: it guards setState, not the
 * write that already went out. This is the guard that has to be checked
 * before the await, which means module scope — a ref is per-mount, and it is
 * the second mount we are stopping.
 */
let legacyMigrationStarted = false;

function readLegacySongs(): { title: string; lyrics: string }[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is { title: string; lyrics: string } =>
          typeof s === 'object' && s != null && typeof (s as { title?: unknown }).title === 'string',
      )
      .map((s) => ({ title: s.title, lyrics: typeof s.lyrics === 'string' ? s.lyrics : '' }))
      .filter((s) => s.title.trim() !== '');
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

/** What the import panel is showing: nothing, a parse to review, or a report. */
type Staged = { songs: ImportedSong[]; errors: { file: string; error: string }[] } | null;

export function Songs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /* Set when the engine could not read songs.json. Not a note — a note is
     dismissed by the next action, and this one has to stay up. */
  const [problem, setProblem] = useState<string | null>(null);

  /* Parsed but not yet written — the review step. */
  const [staged, setStaged] = useState<Staged>(null);
  /* The last commit's report, kept until dismissed so the duplicates it
     names can be reviewed at leisure rather than in a toast that vanishes. */
  const [report, setReport] = useState<SongImportResult | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const [paste, setPaste] = useState('');
  const [pasteParse, setPasteParse] = useState<ImportedSong | null>(null);
  const [dragging, setDragging] = useState(false);

  /** Never rejects: a failed list leaves the previous one on screen rather
      than taking the whole commit path down with it. */
  const refresh = useCallback(async () => {
    const list = await window.api?.songs?.list().catch(() => null);
    if (Array.isArray(list)) setSongs(list);
    return list ?? [];
  }, []);

  /*
   * First load: migrate anything left in localStorage, then list.
   *
   * The migration runs before the first list so the church never sees its
   * own songs missing, not even for a frame.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const api = window.api?.songs;
      if (!api) return;
      const legacy = legacyMigrationStarted ? [] : readLegacySongs();
      if (legacy.length > 0) {
        // Claimed before the first await, so the StrictMode remount that is
        // already queued finds nothing left to do. See legacyMigrationStarted.
        legacyMigrationStarted = true;
        try {
          const parsed = await Promise.all(
            legacy.map((s) =>
              // Through the parser, not straight in: the old screen stored one
              // blob of lyrics, and the plain-text importer is what turns its
              // blank-line-separated stanzas into labelled sections.
              //
              // The lyrics alone, with the stored title reattached afterwards.
              // The title is passed as the filename because that is where the
              // parser looks first, but it is then overwritten unconditionally
              // anyway: a church's own title is the one fact this migration is
              // certain of, and no parse of the words should be allowed to
              // replace it — a blob with no blank lines has its first lyric
              // line promoted to the title, which is how "Amazing Grace"
              // becomes "Amazing grace, how sweet the sound".
              api.importText(s.lyrics, `${s.title}.txt`).then((song) => ({ ...song, title: s.title })),
            ),
          );
          await api.importCommit(parsed);
          localStorage.removeItem(LEGACY_KEY);
          if (!cancelled) {
            // A legacy row with no words at all parses to no sections. It is
            // still brought over — a title the church typed is worth keeping
            // and is trivially refilled — but saying so beats letting them
            // find the empty ones on a Sunday.
            const empty = parsed.filter((p) => p.sections.length === 0).length;
            setNote(
              `brought ${parsed.length} song${parsed.length === 1 ? '' : 's'} over from the old library` +
                (empty > 0 ? ` — ${empty} had no words saved and came over as ${empty === 1 ? 'a title' : 'titles'} only` : ''),
            );
          }
        } catch {
          /* Leave the key alone — better a duplicate next launch than a loss.
             The claim flag stays set for this session so the retry happens on
             a clean mount rather than racing the one still unwinding. */
        }
      }
      const list = await api.list().catch(() => []);
      if (!cancelled && Array.isArray(list)) setSongs(list);
      // Asked after the list, because it only matters once there is an empty
      // library on screen to explain. A church staring at stock hymns where
      // four hundred of its own songs used to be needs to know the file is
      // still there and unread, not start importing over the top of it.
      const trouble = await api.problem?.().catch(() => null);
      if (!cancelled && trouble) setProblem(trouble);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Titles and lyrics both — half-remembered words are how a song gets found. */
  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      needle === ''
        ? songs
        : songs.filter(
            (s) =>
              s.title.toLowerCase().includes(needle) ||
              s.authors?.some((a) => a.toLowerCase().includes(needle)) ||
              s.sections.some((sec) => sec.lines.join(' ').toLowerCase().includes(needle)),
          ),
    [songs, needle],
  );

  const open = songs.find((s) => s.id === openId) ?? null;

  const setCurrent = (song: Song) => {
    window.api?.setCurrentSongLyrics(flattenLyrics(song.sections));
    setCurrentId(song.id);
  };

  const remove = async (song: Song) => {
    // Seeded hymns are deleted permanently — the store remembers the key so
    // they cannot come back on the next launch. Say so before it happens.
    const warning =
      song.origin === 'seed'
        ? `Remove "${song.title}"? It is one of the hymns shipped with Trilorah, and removing it is permanent — it will not come back.`
        : `Remove "${song.title}" from the library?`;
    if (!window.confirm(warning)) return;
    setNote(null);
    try {
      await window.api?.songs?.remove(song.id);
    } catch (err) {
      // A removal that did not reach disk is back after the next launch. Say
      // so now rather than let the row quietly reappear on Sunday.
      setNote(`"${song.title}" could not be removed (${err instanceof Error ? err.message : String(err)})`);
      return;
    }
    if (openId === song.id) setOpenId(null);
    if (currentId === song.id) setCurrentId(null);
    void refresh();
  };

  /* --- import: the three ways in ---------------------------------- */

  /** Show a parse for review rather than writing it. */
  const stage = (parsed: ImportedSong[], errors: { file: string; error: string }[] = []) => {
    setReport(null);
    setReviewing(false);
    setStaged({ songs: parsed, errors });
  };

  const importFiles = async () => {
    setNote(null);
    try {
      const res = await window.api?.songs?.importFiles();
      if (!res || res.canceled) return;
      if (!res.success) {
        setNote('could not read those files');
        return;
      }
      // Errors alongside songs is a normal outcome, not a failure: one bad
      // file in a folder of forty names itself and the rest still import.
      stage(res.songs ?? [], res.errors ?? []);
    } catch {
      setNote('could not read those files');
    }
  };

  /**
   * Dropped files, read in the renderer and parsed one at a time.
   *
   * Same destination as the picker — parse, review, commit — because the
   * gesture should not change what happens to the songs.
   */
  const importDropped = async (files: File[]) => {
    const api = window.api?.songs;
    if (!api) return;
    const parsed: ImportedSong[] = [];
    const errors: { file: string; error: string }[] = [];
    for (const file of files) {
      try {
        parsed.push(await api.importText(await file.text(), file.name));
      } catch (err) {
        errors.push({ file: file.name, error: err instanceof Error ? err.message : String(err) });
      }
    }
    stage(parsed, errors);
  };

  /** The paste box: parse now, show the sections, commit on the second press. */
  const parsePaste = async () => {
    const text = paste.trim();
    if (!text) return;
    try {
      const parsed = await window.api?.songs?.importText(text);
      if (parsed) setPasteParse(parsed);
    } catch {
      setNote('could not read that — paste the words with a blank line between stanzas');
    }
  };

  /**
   * The write step — and the only step that can lose the operator's work.
   *
   * Everything before this is recoverable: a parse can be redone, a picker
   * reopened. Once "Add 40 to library" is pressed the staged parse is the
   * only copy in the app, and the files it came from may already be back in
   * a bag. So a failed write keeps the staging open and says so, rather than
   * clearing the panel and leaving the operator to guess whether forty songs
   * landed. Clearing only on success is the whole rule.
   */
  const commit = async (parsed: ImportedSong[]) => {
    if (parsed.length === 0) return;
    setNote(null);
    let res: SongImportResult | undefined;
    try {
      res = await window.api?.songs?.importCommit(parsed);
    } catch (err) {
      setNote(
        `nothing was saved — the library could not be written to (${err instanceof Error ? err.message : String(err)}). ` +
          'the songs are still here; try again once there is room on the disk.',
      );
      return;
    }
    if (!res) {
      setNote('nothing was saved — the engine did not answer. the songs are still here; try again.');
      return;
    }
    setStaged(null);
    setPaste('');
    setPasteParse(null);
    // Refresh BEFORE the report renders. CommitReport resolves the duplicate
    // ids against this list, and the ids it most needs are the ones just
    // imported — show the report first and every freshly-imported row in it
    // resolves to nothing, so the operator expands "6 look like duplicates"
    // and gets six empty boxes.
    await refresh();
    setReport(res);
  };

  /* Drag-and-drop over the whole screen. Counted rather than toggled: moving
     the pointer over a child fires dragleave on the parent, and a boolean
     flickers off every time the cursor crosses a panel edge. */
  const dragDepth = useRef(0);

  if (!hasEngine()) {
    return (
      <div className="space-y-6">
        <Header />
        <EngineNote what="engine not connected — the song library lives in the Electron main process" />
      </div>
    );
  }

  return (
    <div
      className="space-y-6"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        // preventDefault first, before any reason to bail out. A drop that
        // reaches Chromium's default handling navigates the window to the
        // file, which replaces the whole operator UI with raw text — and a
        // dropped FOLDER produces an empty `files`, which is exactly the
        // early return that used to skip this line. The main process guards
        // this too (guardNavigation), but the belt goes on first.
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) {
          setNote('nothing to import there — drop the song files themselves, not the folder');
          return;
        }
        void importDropped(files);
      }}
    >
      <Header />

      {problem && (
        <Panel className="border-accent">
          <SectionLabel>the library could not be read</SectionLabel>
          <p className="mt-1 text-sm">{problem}</p>
          <p className="mt-2 text-xs text-neutral-400">
            your songs have not been deleted — nothing will be written over them. the unreadable
            file and a copy of it are in Trilorah's data folder as songs.json and
            songs.json.corrupt.
          </p>
        </Panel>
      )}

      {dragging && (
        <Panel className="border-dashed border-accent">
          <p className="text-sm">drop the song files to import them</p>
        </Panel>
      )}

      <ImportPanel
        note={note}
        staged={staged}
        report={report}
        reviewing={reviewing}
        songs={songs}
        paste={paste}
        pasteParse={pasteParse}
        onImportFiles={() => void importFiles()}
        onPaste={(v) => {
          setPaste(v);
          setPasteParse(null);
        }}
        onParsePaste={() => void parsePaste()}
        onCommit={(parsed) => void commit(parsed)}
        onDiscard={() => {
          setStaged(null);
          setPaste('');
          setPasteParse(null);
        }}
        onReview={() => setReviewing((r) => !r)}
        onDismissReport={() => {
          setReport(null);
          setReviewing(false);
        }}
      />

      {open ? (
        <SongSheet
          song={open}
          current={currentId === open.id}
          onBack={() => setOpenId(null)}
          onSetCurrent={() => setCurrent(open)}
          onRemove={() => void remove(open)}
        />
      ) : (
        <Library
          songs={matches}
          total={songs.length}
          query={query}
          currentId={currentId}
          onQuery={setQuery}
          onOpen={setOpenId}
          onSetCurrent={setCurrent}
        />
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="space-y-1">
      <h2 className="text-xl font-semibold tracking-tight">Songs</h2>
      <p className="text-sm text-neutral-500">
        The worship set's words — imported from your own SongSelect or OpenLyrics files, or typed
        in. The current song tells the engine when to hold a clean background.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

function ImportPanel({
  note,
  staged,
  report,
  reviewing,
  songs,
  paste,
  pasteParse,
  onImportFiles,
  onPaste,
  onParsePaste,
  onCommit,
  onDiscard,
  onReview,
  onDismissReport,
}: {
  note: string | null;
  staged: Staged;
  report: SongImportResult | null;
  reviewing: boolean;
  songs: readonly Song[];
  paste: string;
  pasteParse: ImportedSong | null;
  onImportFiles: () => void;
  onPaste: (value: string) => void;
  onParsePaste: () => void;
  onCommit: (parsed: ImportedSong[]) => void;
  onDiscard: () => void;
  onReview: () => void;
  onDismissReport: () => void;
}) {
  return (
    <Panel dataTour="song-import">
      <PanelHeader>import</PanelHeader>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button label="Import files…" variant="solid" onClick={onImportFiles} />
        <span className="text-xs text-neutral-400">
          songselect chordpro (.cho .chopro .crd) · plain text (.txt) · openlyrics (.xml) — or drop
          them anywhere on this screen
        </span>
      </div>
      {note && <p className="mt-3 text-sm text-neutral-500">{note}</p>}

      {/* The review step: parsed, nothing written yet. */}
      {staged && <StagedReview staged={staged} onCommit={onCommit} onDiscard={onDiscard} />}

      {/* The report from the last commit, duplicates and all. */}
      {report && (
        <CommitReport
          report={report}
          reviewing={reviewing}
          songs={songs}
          onReview={onReview}
          onDismiss={onDismissReport}
        />
      )}

      {!staged && (
        <div className="mt-4 space-y-3 border-t border-hairline pt-4">
          <Field
            label="or paste the words"
            hint="blank line between stanzas · a line reading “Chorus” or “Verse 2” names the section"
          >
            <textarea
              value={paste}
              onChange={(e) => onPaste(e.target.value)}
              placeholder={'Song title\n\nVerse 1\nfirst line\nsecond line\n\nChorus\n…'}
              rows={6}
              className="w-full text-sm leading-relaxed"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button
              label={pasteParse ? 'Add to library' : 'Check it parsed'}
              variant={pasteParse ? 'solid' : 'outline'}
              disabled={paste.trim() === ''}
              onClick={() => (pasteParse ? onCommit([pasteParse]) : onParsePaste())}
            />
            {pasteParse && <TextButton label="RE-CHECK" onClick={onParsePaste} />}
          </div>
          {/* Show the parse before saving: the point of the paste box is that
              it splits a block into sections, and the only way to know it
              split it the way you meant is to look. */}
          {pasteParse && <ParsePreview song={pasteParse} />}
        </div>
      )}
    </Panel>
  );
}

/** A parsed-but-unsaved song: its credits and the sections as they came out. */
function ParsePreview({ song }: { song: ImportedSong }) {
  return (
    <div className="space-y-2 rounded-md border border-hairline bg-paper px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-sm font-semibold">{song.title || 'untitled'}</span>
        <Pill>{shapeOf(song)}</Pill>
        {creditOf(song) && <span className="text-xs text-neutral-400">{creditOf(song)}</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {song.sections.map((section, i) => (
          <div key={i} className="space-y-1">
            <SectionLabel>{section.label}</SectionLabel>
            <p className="whitespace-pre-line text-xs leading-relaxed text-neutral-600">
              {section.lines.join('\n')}
            </p>
          </div>
        ))}
      </div>
      {song.copyright && <p className="text-xs text-neutral-400">{song.copyright}</p>}
    </div>
  );
}

/** Parsed files, waiting to be committed — with any file that would not read. */
function StagedReview({
  staged,
  onCommit,
  onDiscard,
}: {
  staged: NonNullable<Staged>;
  onCommit: (parsed: ImportedSong[]) => void;
  onDiscard: () => void;
}) {
  const { songs: parsed, errors } = staged;
  return (
    <div className="mt-4 space-y-3 border-t border-hairline pt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm">
          {parsed.length} song{parsed.length === 1 ? '' : 's'} read — nothing saved yet
        </span>
        <Button
          label={`Add ${parsed.length} to library`}
          variant="solid"
          disabled={parsed.length === 0}
          onClick={() => onCommit(parsed)}
        />
        <TextButton label="DISCARD" onClick={onDiscard} />
      </div>
      {errors.length > 0 && (
        <div className="space-y-1">
          <SectionLabel>could not be read</SectionLabel>
          {errors.map((e) => (
            <p key={e.file} className="text-xs text-neutral-500">
              {e.file} — {e.error}
            </p>
          ))}
        </div>
      )}
      {parsed.length > 0 && (
        <ul className="divide-y divide-hairline rounded-md border border-hairline">
          {parsed.map((song, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2">
              <span className="text-sm">{song.title || 'untitled'}</span>
              <span className="text-xs text-neutral-400">{shapeOf(song)}</span>
              {creditOf(song) && <span className="text-xs text-neutral-400">{creditOf(song)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * What the commit did — "142 imported, 6 look like duplicates".
 *
 * Nothing was dropped and nothing was overwritten: a duplicate is a report,
 * not an action. Each row names every song now holding that title, existing
 * copies included, so the operator can look at them side by side and decide
 * which to keep.
 */
function CommitReport({
  report,
  reviewing,
  songs,
  onReview,
  onDismiss,
}: {
  report: SongImportResult;
  reviewing: boolean;
  songs: readonly Song[];
  onReview: () => void;
  onDismiss: () => void;
}) {
  const dupes = report.duplicates;
  // The report's own rows are the fallback. commit() refreshes before
  // rendering this, but a list() that failed would otherwise leave the
  // just-imported half of every duplicate group resolving to nothing — and a
  // group whose members are ALL new (the same file dropped twice in one
  // batch) would render as a heading over an empty box, which is the exact
  // opposite of the side-by-side comparison this exists for.
  const byId = new Map<string, Song>([...report.imported, ...songs].map((s) => [s.id, s]));
  return (
    <div className="mt-4 space-y-3 border-t border-hairline pt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm">
          {report.imported.length} imported
          {dupes.length > 0 &&
            `, ${dupes.length} look${dupes.length === 1 ? 's' : ''} like a duplicate`}
        </span>
        {dupes.length > 0 && (
          <TextButton label={reviewing ? 'HIDE' : 'REVIEW DUPLICATES'} onClick={onReview} />
        )}
        <TextButton label="DISMISS" onClick={onDismiss} />
      </div>
      {dupes.length > 0 && !reviewing && (
        <p className="text-xs text-neutral-400">
          every song was imported — nothing was replaced or skipped. review them when you have a
          moment and remove the copies you do not want.
        </p>
      )}
      {reviewing &&
        dupes.map((dupe) => (
          <div key={dupe.title} className="space-y-1 rounded-md border border-hairline px-3 py-2">
            <SectionLabel>{dupe.title}</SectionLabel>
            {dupe.ids.map((id) => {
              const song = byId.get(id);
              if (!song) return null;
              return (
                <p key={id} className="text-xs text-neutral-500">
                  {song.title} — {shapeOf(song)}
                  {creditOf(song) && ` · ${creditOf(song)}`}
                  {song.origin === 'seed' && ' · shipped hymn'}
                </p>
              );
            })}
          </div>
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Library                                                             */
/* ------------------------------------------------------------------ */

function Library({
  songs,
  total,
  query,
  currentId,
  onQuery,
  onOpen,
  onSetCurrent,
}: {
  songs: readonly Song[];
  total: number;
  query: string;
  currentId: string | null;
  onQuery: (q: string) => void;
  onOpen: (id: string) => void;
  onSetCurrent: (song: Song) => void;
}) {
  return (
    <Panel pad={false} dataTour="song-library">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hairline px-4 py-3">
        <SectionLabel>library</SectionLabel>
        {total > 0 && (
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="a title, an author, or a line you remember"
            className="w-full max-w-xs text-sm sm:w-64"
          />
        )}
      </div>

      {total === 0 ? (
        <div className="px-4 py-6">
          {/* Rare — a fresh install is seeded — but a church that cleared the
              hymns out lands here, and what it needs is the way back in. */}
          <EmptyState>
            nothing in the library — import your SongSelect, plain-text or OpenLyrics files above,
            or paste a song's words
          </EmptyState>
        </div>
      ) : songs.length === 0 ? (
        <div className="px-4 py-4">
          <EmptyState>nothing matches "{query.trim()}"</EmptyState>
        </div>
      ) : (
        <ul className="divide-y divide-hairline">
          {songs.map((song) => (
            <li
              key={song.id}
              className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-l-2 px-4 py-3 ${
                currentId === song.id ? 'border-accent bg-paper' : 'border-transparent'
              }`}
            >
              <span className="flex min-w-0 flex-col gap-y-0.5">
                <span className="flex min-w-0 items-baseline gap-x-3">
                  {/* The title opens the song — its sections are the thing
                      you came for, and a row that only sets a flag hides
                      them behind nothing. */}
                  <button
                    type="button"
                    onClick={() => onOpen(song.id)}
                    className={`truncate text-left text-sm underline-offset-4 hover:underline ${
                      currentId === song.id ? 'font-semibold' : ''
                    }`}
                  >
                    {song.title}
                  </button>
                  {currentId === song.id && <Pill active>current</Pill>}
                </span>
                <span className="text-xs text-neutral-400">
                  {[creditOf(song), shapeOf(song)].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="flex items-center gap-x-4">
                <Button label="Set as current" onClick={() => onSetCurrent(song)} />
                <TextButton label="OPEN" onClick={() => onOpen(song.id)} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-hairline px-4 py-3 text-xs text-neutral-400">
        "set as current" tells the worship agent which song is live — the engine keeps the output
        clean between verses during worship
      </p>
    </Panel>
  );
}

/**
 * A song, opened — its sections top to bottom.
 *
 * Reading, not editing: what the operator does here is check that a song
 * imported the way they expected, and the shape of the stanzas is what
 * answers that. Editing arrives with the design pass, over songs.update.
 */
function SongSheet({
  song,
  current,
  onBack,
  onSetCurrent,
  onRemove,
}: {
  song: Song;
  current: boolean;
  onBack: () => void;
  onSetCurrent: () => void;
  onRemove: () => void;
}) {
  return (
    <Panel pad={false}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hairline px-4 py-3">
        <span className="flex min-w-0 items-baseline gap-x-3">
          {/* The way back is the title itself: the header already says where
              you are, so it is the natural thing to press to leave. */}
          <button
            type="button"
            onClick={onBack}
            title="back to the library"
            className="truncate text-sm font-semibold underline-offset-4 hover:underline"
          >
            ← {song.title}
          </button>
          {current && <Pill active>current</Pill>}
          {song.origin === 'seed' && <Pill title="shipped with Trilorah">hymn</Pill>}
        </span>
        <span className="flex items-center gap-x-4">
          <Button label="Set as current" onClick={onSetCurrent} />
          <TextButton label="REMOVE" onClick={onRemove} />
        </span>
      </div>

      {creditOf(song) && (
        <p className="border-b border-hairline px-4 py-2 text-xs text-neutral-400">{creditOf(song)}</p>
      )}

      {song.sections.length === 0 ? (
        <div className="px-4 py-4">
          <EmptyState>no words in this one</EmptyState>
        </div>
      ) : (
        <div className="grid gap-x-8 gap-y-5 px-4 py-4 sm:grid-cols-2">
          {song.sections.map((section, i) => (
            <div key={i} className="space-y-1">
              <SectionLabel>{section.label}</SectionLabel>
              <p className="whitespace-pre-line font-scripture text-sm leading-relaxed">
                {section.lines.join('\n')}
              </p>
            </div>
          ))}
        </div>
      )}

      {song.copyright && (
        <p className="border-t border-hairline px-4 py-3 text-xs text-neutral-400">{song.copyright}</p>
      )}
    </Panel>
  );
}
