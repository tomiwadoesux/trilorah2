# Trilorah — Build Map (2026-09-06)

One list of everything the planning docs say to build, in dependency order.
Sources: [IDEAS-BACKLOG.md](IDEAS-BACKLOG.md), [design/UI-INVENTORY.md](design/UI-INVENTORY.md), [QR-COMPANION-BRAINSTORM.md](QR-COMPANION-BRAINSTORM.md), [STOCK-BACKGROUNDS-BRAINSTORM.md](STOCK-BACKGROUNDS-BRAINSTORM.md), [CHURCH_PRESENTATION_FEATURES_PLAN.md](CHURCH_PRESENTATION_FEATURES_PLAN.md).

Status: ✅ done · 🟡 partial · ⬜ not started · ❌ decided against

**2026-09-07 engine pass:** everything marked ✅/🟡 below with a file name was built in one autonomous pass — engine, IPC handlers in `electron/main.ts`, and preload bridges in `electron/preload.ts` (`window.api.*`). No UI was touched. `npx vitest run` = 260 tests green, `npm run eval:gate` passes.

---

## Phase 0 — Fixes (days)

| # | Item | Status | Source |
|---|---|---|---|
| 0.1 | Auth on the local WebSocket server (pairing code + token) | ✅ `integrations/pairing.ts`, `websocketServer.ts` | backlog 22 |
| 0.2 | Wire nav-next / nav-previous voice commands; trim generic defaults | ✅ | backlog 17 |
| 0.3 | Remove/document dead ML resolver client (`mlClient.ts` → :8765) | ✅ deleted | backlog 19 |
| 0.4 | Ask friend about "pastor suffix" meaning | ⬜ | backlog 18 |

## Phase 1 — Design system + desktop UI (the big one, weeks)

Everything else hangs off this. 15 foundations, 71 primitives, 110 domain components, 17 screens.

| # | Item | Status | Source |
|---|---|---|---|
| 1.1 | Foundations F-01…F-15 (tokens, motion, z-index, icons…) | 🟡 tokens.css, icons.tsx | inventory |
| 1.2 | Primitives C-01…C-71 | 🟡 13 of 71 in `src/ui/primitives` | inventory |
| 1.3 | **EdgeGlow** primitive (CSS border-beam, 3 signals, ping) | ⬜ | backlog 11 |
| 1.4 | Generated avatars C-45 (name-hash gradient, church brand colour seed) | 🟡 generator done (`shared/avatar.ts`); component pending | backlog 14 |
| 1.5 | Domain components D-01…D-110 | 🟡 Live, dashboard, library, presentations, projector in sandbox | inventory |
| 1.6 | **Library layout** with folders (Presentations / Songs / Media) | 🟡 data model done (`library/folders.ts` + IPC); UI pending | backlog 12 |
| 1.7 | Screens S-01…S-17 | 🟡 AppShell, Live in sandbox | inventory |
| 1.8 | **Command palette S-15** (⌘K, registry, local embeddings, Shift+Enter actions) | 🟡 engine done (`search/`: registry, entries, BM25+fuzzy index, embedding hook); UI pending | backlog 6 |
| 1.9 | First-run wizard S-12, guided tour S-13, crash S-16, update S-17 | ⬜ | inventory |
| 1.10 | Preacher profile additions: "training complete" line, auto-mode switch, "How they say it" panel, command log, vocabulary list | 🟡 all engine + IPC done; UI pending | backlog 15–18 |
| 1.11 | Song import: SongSelect ChordPro/.txt, OpenLyrics XML, CCLI number field | 🟡 parsers + IPC done (`songs/import.ts`); UI + persistence pending | backlog 23 |
| 1.12 | Seasonal touches (after all of the above) | ⬜ | backlog 13 |

## Phase 2 — Engine (parallel with Phase 1, weeks)

| # | Item | Status | Source |
|---|---|---|---|
| 2.1 | Resolver emits **second candidate + score**; clash rule in auto mode | ✅ `engine/candidates.ts` | backlog 16 |
| 2.2 | Auto mode = operator switch gated by eligibility (not eligibility alone) | ✅ `engine/autoMode.ts` + ledger | backlog 16 |
| 2.3 | Per-preacher command phrase layer (`<preacher>/commands.json`) + command event log | ✅ `commandConfig.ts`, `preachers/commandLog.ts` | backlog 17 |
| 2.4 | Per-preacher vocabulary → ASR keyword boost / post-replace | ✅ `preachers/vocabulary.ts` | backlog 18 |
| 2.5 | Per-preacher alias map from ledger corrections (book-name misses) | ✅ already existed (`ledger.resolveAlias`) | backlog 19 |
| 2.6 | Whisper `small` option for accented / non-English | ✅ `whisperModelSize` setting | backlog 19 |
| 2.7 | **Eval harness**: fixtures from corrections, precision/recall/FP/latency, CI gate | ✅ `evals/`, `npm run eval:gate`, ledger export | backlog 25 |
| 2.8 | Stock backgrounds: scripture → preset auto-pick; video backgrounds on projector | 🟡 preset picker done (`media/presetPicker.ts`); video on projector pending | stock doc |
| 2.9 | Bundled curated offline image pack | ⬜ | stock doc |

**2026-09-08 EasyWorship parity pass** — what was worth poaching from EasyWorship 8's feature list, built additively on the existing three output windows, WS server, and Themes. Engine + IPC + UI. *Not* poached (decided against): schedule builder, slide editor, media store, CCLI catalogue, Planning, PowerPoint import, native NDI (needs NDI runtime + native binding — the alpha STREAM window covers the OBS/vMix case; revisit later).

| # | Item | Status | Source |
|---|---|---|---|
| 2.10 | **Message alerts** — one at a time, auto-expire, target all/projector/stream/stage; Live panel with presets; WS `showAlert`/`dismissAlert` | ✅ `alerts/alerts.ts`, Live `AlertPanel`, `alertPresets` setting | EasyWorship "real-time alerts" |
| 2.11 | **Output roles + screen state** — projector / stream (lower-third for OBS window capture) / stage (clock + up-next); `live/clear/black/logo` on every output; BLACK/LOGO buttons; black/logo survive an auto push | ✅ `output/outputState.ts`, `src/output.tsx`, Settings "outputs & alerts" | EasyWorship multiple outputs, transitions, alpha out |
| 2.12 | **Keyword Bible search** — FTS5 over bible.db (`npm run bible:fts`, LIKE fallback), Bible screen "search by words", omnibox fallback for 2+ words that aren't a reference; prev/next chapter continuous reading; click a verse to preview | ✅ `data/bibleSearch.ts`, `scripts/build-bible-fts.mjs` | EasyWorship keyword search + continuous scroll |
| 2.13 | **Bitfocus Companion module** — pairs with the 6-digit code, all WS commands, feedbacks + variables | ✅ `integrations/companion-module-trilorah/` (not yet published to the Companion module store) | EasyWorship Stream Deck plug-in |
| 2.14 | Native NDI sender (alpha) | ⬜ decide after pilot feedback | EasyWorship NDI |
| 2.15 | MIDI-in cues (Playback / Prime / Ableton) | ⬜ | EasyWorship MIDI |

**2026-09-09 ProPresenter parity pass** — a second stalk, this time of ProPresenter 7/21. Same filter: take what serves "no prep, no operator", leave the production console alone. *Not* poached: Planning Center integration, 8 outputs / SDI / Syphon, MIDI+DMX out, timecode follow, Props / Macros / Timeline, the slide editor and PPTX importer, ProContent, chord charts, AirCast. Each would pull Trilorah toward being a worse ProPresenter instead of a better assistant.

| # | Item | Status | Source |
|---|---|---|---|
| 2.16 | **Service timers** — countdown / counts-to-a-time / stopwatch, overrun into negative, persisted definitions, Live panel, stage-monitor slot, `{timer:x}` in messages | ✅ `engine/timers.ts`, `shared/timerDisplay.ts`, Live `TimersPanel` | ProPresenter Timers |
| 2.17 | **Message tokens** — `{clock}`, `{timer:x}`, `{custom}` holes filled at trigger time; Live prompts for what is still unfilled; single-pass fill so operator input is never re-expanded | ✅ `alerts/tokens.ts`, `alert-inspect` IPC | ProPresenter Messages |
| 2.18 | **Passage layout** — break on new verse, inline verse numbers, reference each/first/last/none, translation suffix, long-verse splitting at sentence boundaries, **second translation** on the same slide | ✅ `shared/verseDisplay.ts`, Themes "passage layout", `src/output.tsx` | ProPresenter Bibles |
| 2.19 | **Reference parsing** — ranges (`john 3:16-18`), the `Matt 1 2 3` shorthand, numbered books, en/em dashes, reversed ranges, mid-type detection | ✅ `shared/parseReference.ts`, omnibox | ProPresenter passage entry |
| 2.20 | Stage monitor: verse text + timer for the preacher | ✅ `src/output.tsx`, Settings "stage timer" | ProPresenter Stage Screens |
| 2.21 | Windowed output (framed, for screen-share) | ⬜ | ProPresenter 18 Windowed Output |

## Phase 3 — Companion + relay (needs Supabase restored, weeks)

Sequencing from the QR brainstorm: cloud sync of finished services → realtime → public page.

| # | Item | Status | Source |
|---|---|---|---|
| 3.1 | Restore Supabase; CloudSync module; "save finished service" | ⬜ | QR doc phase 1 |
| 3.2 | Relay: realtime event stream per church, stable slug | ⬜ | QR doc phase 2 |
| 3.3 | Public companion page `/live/[slug]`: verse, transcript, replay buffer | ⬜ | QR doc phase 3 |
| 3.4 | Share button (native share sheet), church toggle link-vs-Wi-Fi-only | 🟡 settings + share-link IPC + wifi-only gating done; page pending | backlog 7 |
| 3.5 | "Watch the stream" URL field + button | 🟡 `streamUrl` setting done; UI pending | backlog 8 |
| 3.6 | Viewer count pill on Live; city breakdown on recap | 🟡 engine done (`companion/viewerStats.ts`); needs relay + UI | backlog 9 |
| 3.7 | Congregation polls (poll/vote events, weighted tally into candidates) | 🟡 engine done (`companion/polls.ts`, `events.ts`); needs relay + page | backlog 10 |
| 3.8 | Take-home recap page after service | ⬜ | backlog 7 |
| 3.9 | Church logo: laptop-local + one cached copy on relay | ⬜ | backlog 14 |
| 3.10 | Stock-image proxy + shared cache on Supabase edge fn | ⬜ | stock doc |
| 3.11 | Web admin dashboard (17 web screens) | ⬜ | inventory |

## Phase 4 — Remote + languages (after 1–3)

| # | Item | Status | Source |
|---|---|---|---|
| 4.1 | `/remote` PWA on LAN, paired via 0.1, scripture + auto controls only | 🟡 socket protocol + handlers done; page pending | backlog 22 |
| 4.2 | Languages to parity: es, fr, pt → zh → hi (needs Bible text) | 🟡 packs + 4 Bibles exist | backlog 20 |
| 4.3 | UI string localisation | ⬜ | backlog 20 |

## Already built (from the older presentation plan)

Thin-shell App.tsx, Fabric slide editor, FFmpeg trim editor, 3 output windows w/ alpha, OBS websocket, MIDI sync, Stream Deck socket API, stock image search (Pixabay/Pexels). These get **re-skinned in Phase 1**, not rebuilt.

## Decided against

Audio streaming on companion (8) · LibreTranslate for scripture (21) · Kubernetes (24) · CCLI partner API for now (23) · per-preacher model fine-tuning (19) · uploaded avatars (14).
