# Importing from another presentation app

Implemented 2026-10-08. Open **.tri** beside **Run of service**, choose **Import
from another app…**, and select any files from the old app: exports, databases,
songs, pictures. There is no "which app" step; each file is identified by its
structure (`electron/importers/generic.ts` → `detect`). The review screen shows
categories, individual items, lyric previews, conversion notes, and, above them,
the things the importer is not sure about (see *Asking the operator* below). Import appends the selected service
to the current run unless **Open as a new service** is selected. Replacing a
nonempty run requires the existing review checkbox.

## Supported content

| Source | Inputs | Conversion |
| --- | --- | --- |
| EasyWorship 6/7 | Packed `.ewsx`, a ZIP containing the export/databases, or `Songs.db` and `SongWords.db` selected together | Editable song text, ordered song slides, authors, copyright, CCLI song number; recognized packaged images/videos |
| ProPresenter 7-style files | `.pro`, `.proBundle`, `.proPlaylist`, or ZIP containing presentations and media | Editable text slides in Songs; section labels and selected arrangements including repeated groups; available CCLI metadata; packaged images/videos; modern playlist headers and presentation order |
| ProPresenter 6 | `.pro6` or `.pro6x` bundle | Editable text and original slide order, group labels, available credits and packaged images/videos |
| PewBeam | Markdown/text/Word transcript and sermon-note exports | Text becomes editable notes in the run of service, separated by paragraph/line |
| PewBeam themes | Single theme JSON, a `theme` wrapper, a theme array, or a `themes` array | Recognized font family/size/weight, text color, and image/solid-color background; choose one theme per import, staged for preview |
| OpenLyrics / OpenSong (OpenLP, Quelea, OpenSong, others) | `<song>` XML with `<lyrics>` | Title, authors, copyright, CCLI number, verse names, line breaks |
| Any other app | SQLite databases, JSON, XML, plain text, RTF, Word | Generic harvest: tables or repeated records with a title-shaped and a lyrics-shaped column become songs; lyric-shaped text files become songs once the operator confirms; prose becomes notes; pictures and videos come in by type; everything else is listed as skipped with a reason |

Ordinary media support follows the app's media shelf: PNG, JPG/JPEG, WebP, GIF,
AVIF, BMP; MP4, MOV, M4V and WebM. Codec availability still determines playback.
An image or video must be packaged or explicitly selected in the file picker.
The importer never follows arbitrary filesystem paths from another app's files
and never downloads remote references. Ambiguous duplicate filenames are reported.

For ProPresenter, export a **Presentation Bundle** or a **Playlist with media**.
A plain `.pro` presentation only supplies presentation data. For EasyWorship,
use a packed/standalone schedule to include its media. The importer shows any
missing resources and can still recover supported content from other valid files.
Transfer ZIPs can contain supported export bundles; at most four archive layers
are opened, with one shared expansion budget across the batch.

## Asking the operator

Anything the importer cannot place becomes a question card in the review step
(`src/design/screens/run/ForeignQuestions.tsx`). **Import** stays disabled until
every card is answered or **skip the rest** is pressed. Each answer re-reads the
chosen files with the answer applied (`tri-answer-foreign`, same preview token),
so the checklist always shows exactly what will be imported.

- A **text** file whose lines read like lyrics (short lines, several stanzas)
  asks *Song · Sermon notes · Skip*. Prose never asks; it becomes notes as before.
- A **table** (SQLite table, JSON array, repeated XML element) with more than one
  plausible title or lyrics column asks which column is which. A table with
  exactly one of each is imported with a note saying the columns were guessed.
- Table answers are remembered on this laptop in `userData/import-recipes.json`,
  keyed by a structure signature (table and column names and types, hashed).
  No song text or file content is stored. The next file with the same structure
  imports without a question; its card shows collapsed as *answered last time*.
- Text answers are per file and are not remembered.

Shared recipes (an answer becoming the default for every church once four
churches have given it) are designed below and not yet built.

## Fidelity and limits

- EasyWorship service order, non-song presentations, theme layouts, and media
  relationships are not reconstructed. Song slide order is retained. Legacy
  `.ews`/Paradox databases and `.ewprofile` are unsupported.
- ProPresenter text is displayed with Trilorah's styling. This is content
  migration, not pixel-identical rendering. Timelines, effects, macros, timers,
  device actions, and automatic background changes are not recreated. Pro6 saved
  arrangements are not applied. Missing playlist presentations become named notes.
  Disabled slides/actions and hidden playlist items are omitted with a conversion
  note, rather than being activated in the imported service.
- Repeated uses of the same presentation/arrangement share one imported song.
  Different text/arrangements can produce separate editable songs.
- PewBeam's public documentation specifies exports but not a versioned JSON
  schema. Theme mapping is conservative: recognized `text`/`verse` or flat text
  properties, and `background` or flat background properties. Unknown structures
  fail with a readable report. It does not claim compatibility with every release.
  Embedded PNG/JPEG/WebP data images are supported up to 8 MiB. Gradients,
  positioning, shadows, and other effects are not mapped. Fonts are not installed.
- PDF text, standalone audio, embedded Word objects, foreign Bible databases,
  and trained recognition models are not imported through this flow.
- Existing songs with matching titles start unchecked. Selecting a run also
  selects its required songs/media, shown as required in the review. Matching
  hashes from previous package media imports also start unchecked. Selected
  duplicates are imported as new copies; existing records are never replaced.
- Up to 200 chosen files, 20,000 archive entries, 2 GiB per batch after expansion,
  1 GiB per archive entry, 16 MiB per text/presentation file, and 128 MiB per
  EasyWorship database. Preview packages use the existing `.tri` format limits.

## Transaction and storage

Conversion produces a temporary, self-contained `.tri` snapshot. Preview does
not write to the library. Commit verifies that snapshot, resolves selection
dependencies, extracts only selected assets, and uses the existing rollback-capable
library transaction. Source exports may be moved or changed after inspection
without altering the reviewed snapshot. Importing as a new service never makes
the temporary conversion file the active autosave destination; use Save As.

Archive entries are bounded before extraction and written to generated filenames.
Traversal, links, encrypted entries, duplicate paths, and unsupported compression
are rejected. CRCs are checked except for EasyWorship's known nonstandard
`main.db` CRC. XML entities/DTDs are rejected. Protobuf only traverses known field
paths. SQLite files are opened read-only with trusted schemas disabled.

Abandoned previews are removed on dismissal, eviction, or normal app exit. A crash
can leave an OS temporary directory; it is not part of the user's library.

## Verification and format evidence

Regression fixtures are original synthetic songs, independent ZIP/protobuf
encoders, and SQLite databases matching documented interoperability tables.
They cover Unicode, arrangements, repeated playlist entries, missing resources,
archive boundaries/checksums, preview dismissal, duplicate selection, staged
themes, durable media, and existing library preservation. They do not substitute
for testing representative exports from a church's exact vendor versions.

Additional regressions cover disabled ProPresenter content, legacy RTF encodings
and Cocoa line breaks, quoted XML attributes, Word line breaks/tabs, nested export
bundles, and multi-service package imports. The desktop smoke check also imports
two note files into an existing run and verifies that visible and saved content
agree before saving the combined service.

On 2026-10-08, independent OpenLP EasyWorship fixtures were also checked in the
native desktop runtime: the EW6 library pair produced three readable songs with
14 sections (one further metadata record has no lyrics), and `test1.ewsx`
produced one song with six slides. Full text, authors, Danish characters, slide
order, and repeated choruses matched OpenLP's expected data. Those samples
already passed the earlier parser; the lyric-loss and damaged-song regressions
were reproduced separately with original edge-case fixtures. This is evidence
for those samples, not a guarantee for all EasyWorship releases. Public sample
content is not copied into this repository.

Commands:

```sh
npm run build
npm test -- --configLoader runner --maxWorkers=2
node scripts/foreign-import-smoke.cjs
npx electron scripts/foreign-import-ui-smoke.cjs
```

The 2026-10-08 audit passed the production build, all 1,887 tests in 137 files,
the expanded native EasyWorship checks, and the desktop import/append/save smoke
check. Desktop verification uses an isolated temporary profile; it does not
import test content into the operator's library.

Format references (consulted for field meanings; no third-party parser source is
vendored):

- [EasyWorship schedule transfer](https://help.easyworship.com/SavingTransferringASchedule1.html).
- [ProPresenter export behavior](https://support.renewedvision.com/hc/en-us/articles/360041588774-Syncing-Between-Computers-with-ProPresenter).
- [PewBeam theme and transcript exports](https://pewbeam.com/docs).
- [OpenLP's EasyWorship interoperability implementation](https://gitlab.com/openlp/openlp/-/raw/master/openlp/plugins/songs/lib/importers/easyworship.py), for the SQLite table/column meanings and `main.db` CRC exception.
- [OpenLP's ProPresenter importer](https://gitlab.com/openlp/openlp/-/raw/master/openlp/plugins/songs/lib/importers/propresenter.py), for Pro6 XML field meanings.
- [Public ProPresenter 7.16.2 descriptors](https://github.com/greyshirtguy/ProPresenter7-Proto/tree/master/Proto7.16.2), for known protobuf field numbers. These are community-researched descriptors, not a vendor compatibility guarantee.
- [OpenLP EasyWorship fixture data](https://gitlab.com/openlp/openlp/-/tree/master/tests/resources/songs/easyworship) and [expected import results](https://gitlab.com/openlp/openlp/-/blob/master/tests/openlp_plugins/songs/test_ewimport.py), used for the independent sample comparison.
- [Protobuf defaults](https://protobuf.dev/programming-guides/proto3/#default), for omitted boolean fields in ProPresenter's proto3 data.
- [WordprocessingML tabs](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.tabchar), for preserving text separators during Word import.

## Next: imports from any app (decided 2026-10-08; steps 1–4 built the same day, step 5 pending)

Owner decisions, 2026-10-08:

- The importer should accept exports from any presentation app, not only the
  three readers above. When it cannot tell what something is, it asks the
  operator instead of guessing or failing.
- The review step stays **inside the current Import dialog** (`view === 'import'`
  in `src/design/screens/run/TriPackageActions.tsx`), as an extra step after the
  scan. No separate page.
- An operator's answer teaches that laptop at once. It is also uploaded as a
  **candidate recipe**. A recipe becomes the shared default only after **four
  churches** have given the same answer independently. Disagreeing answers never
  spread; the first answer to reach four wins and the rest are dropped. A church
  can still override the shared default locally.

### Layer 1 — sniff instead of asking which app

Drop the "choose the source app" step (`FOREIGN_SOURCES` picker). The scan
identifies each picked file by structure, not by extension alone:

| Signature | Reader |
| --- | --- |
| ZIP with `main.db` or `Songs.db` + `SongWords.db` | EasyWorship (existing) |
| protobuf with known Pro7 field paths; `RVPresentationDocument` XML | ProPresenter (existing) |
| JSON with `theme`/`themes`; Markdown/Word/text | PewBeam (existing) |
| SQLite with `songs` + `lyrics` columns in OpenLyrics XML | OpenLP (new, open format) |
| `<song>` XML with `<lyrics>` | OpenSong (new, open format) |
| JSON with `shows`/`slides` | FreeShow (new, open format) |
| anything else | Layer 2 |

The `ForeignSource` type becomes a detection result, not an operator choice.
Mixed drops (an EasyWorship zip plus loose JPGs) run each file through its own
reader and merge into one snapshot, as `Content` already does.

### Layer 2 — generic harvest for unknown files

- Every image/video/audio file by `MEDIA_TYPES` is pulled in as media.
- Any SQLite: scan every table for a text column whose rows average several
  lines, paired with a short-text column in the same row. Candidate = song.
- Any XML/JSON: find repeated sibling records that carry one short string and
  one multi-line string. Candidate = song.
- RTF/Word/text: existing text path, candidate = song or note.
- Everything else (binary we cannot read, fonts, executables): listed as skipped
  with a one-line reason. Nothing is silently dropped.

Each candidate carries a **confidence**: `sure` (dedicated reader),
`likely` (generic harvest found exactly one lyric-shaped column), `unsure`
(two or more plausible columns, or a file whose kind is unclear).

### Layer 3 — review step with questions

Inside the existing review view, above the category checklist:

- Summary line: "Found 212 songs, 40 pictures, 6 I'm not sure about."
- `sure` and `likely` items are pre-ticked as today.
- `unsure` items render as cards with a preview and chips:
  **Song · Background picture · Announcement · Note · Skip**. For a tabular
  source the card shows the first two rows and asks "Which column is the
  lyrics? Which is the title?" with the columns as chips.
- The Import button stays disabled while any `unsure` card is unanswered, unless
  the operator presses "skip the rest".
- Answers become a **recipe**: `{ signature, mapping, kind }` where `signature`
  is a hash of the file's structure (table names + column names + types, or the
  JSON/XML key skeleton), never its content.

### Recipes

- Local: `recipes.json` in userData, keyed by signature. Applied automatically on
  the next scan, promoting the item to `likely`. The card still shows, collapsed,
  with "answered last time" and an undo.
- Shared: new Supabase table `import_recipes` with `signature`, `mapping`,
  `church_id`, `created_at`. A view counts distinct `church_id` per
  (`signature`, `mapping`). The desktop fetches recipes with `count >= 4` at
  scan time (cached, offline-safe) and treats them like local ones. Uploads carry
  the structure hash and the mapping only, never song text or media.
- Conflict: if a signature has two mappings and one reaches four first, it wins.
  The other is kept for audit but never served.

### Order of work

1. Sniffing + detection result type; remove the source picker. Existing readers
   unchanged. Regressions: every current fixture still routes to its reader.
2. Generic harvest for SQLite, then XML/JSON, with confidence. Fixtures: an
   unknown SQLite with two text columns, a JSON array of songs, a folder of JPGs.
3. Review cards and chips in the dialog; Import gating; local recipes.
4. OpenLP, OpenSong, FreeShow readers (cheap, open formats).
5. Shared recipes: table, view, upload on answer, fetch on scan, 4-church gate.

Status: steps 1–4 are built and covered by `foreignImport.test.ts`,
`triIpc.test.ts` and the desktop smoke script. Step 5 needs the Supabase project
to exist again. The dedicated OpenLP SQLite reader was not needed: OpenLP's
`songs` table (title + lyrics as OpenLyrics XML) is read by the OpenLyrics parser
when exported as XML, and by the generic harvest when the database is picked.
