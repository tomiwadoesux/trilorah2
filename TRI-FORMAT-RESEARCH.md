# Trilorah portable files and migration research

Research date: 2026-10-03. Status: source review and proposed migration inputs. This document does not establish tested compatibility with foreign applications. No real user export samples were available for this review.

## Verified export formats

| Application | File types | What the primary source establishes | Migration limit |
| --- | --- | --- | --- |
| ProPresenter | `.pro`, `.pro6` presentations; `.proBundle`, `.proPlaylist`; legacy `.pro6x`, `.pro6plx` bundles/playlists | The vendor lists these extensions. A presentation export carries slide data without media. Presentation bundles collect presentations and media; playlist export offers optional media inclusion. [Working with Files](https://learn.renewedvision.com/propresenter/working-with-files) | These are documented export behaviours, not a published binary schema or proof that Trilorah can render them. |
| EasyWorship | `.ewprofile` | The vendor's transfer tool exports profiles and restores their database into EasyWorship. [Transfer EasyWorship Profile](https://support.easyworship.com/support/solutions/articles/24000043114-transfer-easyworship-profile) | The page does not specify the archive layout/database schema. Do not promise a complete profile importer from this documentation alone. |
| EasyWorship 6/7 | `.ewsx` schedules; legacy `.ews`; song database directories | OpenLP's maintained importer has separate handlers for these inputs. It reads `.ewsx` as ZIP containing `main.db` (SQLite), extracts song metadata and ordered RTF text, and deliberately ignores other media. Its database-directory reader uses `Songs.db` with `SongWords.db`. [OpenLP EasyWorship importer source](https://gitlab.com/openlp/openlp/-/raw/master/openlp/plugins/songs/lib/importers/easyworship.py) | This is evidence from a third-party interoperability implementation, not an EasyWorship vendor schema. Its song reader does not prove complete schedule, styling, media or current-version migration. Legacy `.ews` needs its own reader. |
| OpenLP | `.osz`, `.oszl`; internal `.osj` | OpenLP's own source writes ZIP archives containing `service_data.osj` JSON. Full saves add referenced assets; lite saves skip their payloads. JSON contains a service-file version, service theme reference and ordered service items. Version 3 saves use hashed asset filenames. [OpenLP service manager source](https://gitlab.com/openlp/openlp/-/raw/master/openlp/core/ui/servicemanager.py) | Read the internal version and resolve asset references. A lite file cannot supply media bytes it does not contain. A theme name alone is not its full definition. |
| FreeShow | `.show` or `.json` | Public JSON format includes metadata, slides/text/styles, layouts and media references. [SHOW format](https://freeshow.app/docs/format-show) | Native slide styles still need conversion to Trilorah's layouts. A media path is not necessarily an embedded file. |
| FreeShow | `.project`, `.shows` (also `.json`/`.zip` depending on representation) | Public project format supports JSON alone or ZIP with `data.json` and media files. It includes an ordered project list, shows, optional overlays and a `files` list for packaged media. [Project format](https://freeshow.app/docs/format-project) | Inspect the content rather than assuming every project extension is ZIP. Resolve referenced media against the actual archive entries. |

## Portability and documentation caveats

- ProPresenter's vendor documentation recommends presentation bundles or playlists with media when transferring used resources. A plain presentation does not include media. Full computer sync is another operation and can include libraries and linked media. [Syncing Between Computers](https://support.renewedvision.com/hc/en-us/articles/360041588774-Syncing-Between-Computers-with-ProPresenter)
- EasyWorship support explains that packing a schedule is needed to carry backgrounds and videos to another computer; schedule edits can then be imported into that computer's song database through its change-checking workflow. Do not infer that every saved schedule contains all its assets. [Vendor support reply: Preparing schedules at home](https://support.easyworship.com/support/discussions/topics/24000016465)
- FreeShow's pages disagree about media export: its general export page says to move media separately, while its project and format pages describe packaged media. Support both documented representations and test versioned samples. [Exporting](https://freeshow.app/docs/exporting), [Project list](https://freeshow.app/docs/project-list)
- FreeShow documents an EasyWorship song import using both the lyrics database (`SongsWords.db` or `SongWords.db`) and title/metadata database (`Songs.db`). Choosing only the lyrics database loses correct names. This reinforces the need to group related files when scanning a folder. [FreeShow importing](https://freeshow.app/docs/importing)
- OpenLP documents service content including songs, Bible verses, images, notes and custom slides. Its optional missing-song import demonstrates that opening a service and copying resources into a library are separate product actions. [OpenLP service manual](https://manual.openlp.org/service.html)

## Proposed Trilorah handling

1. Treat `.tri` as Trilorah's own versioned portable package. Define and test that format independently of external application formats.
2. For foreign folders/files, identify candidates using extension plus validated signatures, archive entries and schema/version fields. Never identify a generic `.db`, `.json` or `.zip` by extension alone.
3. Present supported items, missing assets, unconverted features and duplicate choices before importing. Preserve the originals and copy chosen resources into managed local storage.
4. Start foreign conversion with song text/metadata and ordinary media. Convert schedules, slide layouts and themes only where a tested mapping exists. Report unsupported macros, animations, output settings and proprietary features explicitly.
5. Remap imported identifiers and relationships consistently. Repeated imports must not silently duplicate resource records or inflate preacher learning evidence.
6. Obtain representative exports by application and version, including packed/unpacked media, non-English text, arrangements, missing assets and duplicate filenames, before claiming compatibility. Source-code observations are research evidence, not a substitute for fixtures.

## Trilorah preacher portability

The app's existing preacher data is stored across profile, teaching, command, vocabulary and correction-ledger JSON files. Portable learning should include the actual taught corrections, vocabulary, command phrases, suppression rules, heard-to-corrected samples, verified review/service evidence and selected profile history. Preserve identity links between these records.

This is reusable text correction and detection evidence, not a separately trained acoustic voice model. `electron/preachers/teaching.ts` explicitly has no training job or audio storage; `soundCheck.ts` keeps an isolated temporary microphone check. Trust and eligibility are calculated from verified ledger records and configured thresholds, so importing a displayed percentage alone is insufficient. Recompute against the receiving installation and keep automatic display under its operator's control.

Relevant local sources: `electron/preachers/preacherProfiles.ts`, `electron/preachers/teaching.ts`, `electron/preachers/vocabulary.ts`, `electron/preachers/commandLog.ts`, `electron/preachers/correctionLedger.ts`, `electron/engine/commandConfig.ts`, and `electron/preachers/soundCheck.ts`.
