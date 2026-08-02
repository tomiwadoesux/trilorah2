# Trilorah — Complete UI Inventory

The full build list for the custom UI: every foundation token, every component, every
screen, every state. Numbered so we can work through them by reference ("build C-14",
"design S-07").

Scope covered:
- **Desktop app** (Electron renderer, `src/`) — 10 tabs + all sub-screens, overlays, and windows
- **Projector output windows** (`src/output.tsx`) — what the congregation sees
- **Web companion** (Next.js, `web/`) — congregation phones + church admin

Current state for reference: `src/components/ui.tsx` has 11 components (Button, TextButton,
Panel, PanelHeader, SectionLabel, Pill, LevelMeter, TrustBar, Toggle, Field, EmptyState).
Everything else below is either new or a promotion of something currently inlined in a screen.

---

# PART 0 — FOUNDATIONS

These come before components. Nothing gets built until these are locked.

| # | Item | What it defines |
|---|---|---|
| F-01 | **Color tokens** | paper / ink / accent / hairline / surface / canvas + the *semantic* additions we're missing: `danger`, `warn`, `ok`, `live`, `preview`, `muted`, `overlay-scrim`, `focus-ring` |
| F-02 | **Dark mode** | Booth operators run in dark rooms. Either a full dark palette or a "booth mode" inversion. Decide now — it changes every component. |
| F-03 | **Type scale** | display / h1 / h2 / h3 / body / body-sm / label / mono / **scripture serif**. Sizes, weights, line-heights, letter-spacing. Current UI uses uppercase-tracked labels everywhere — decide if that survives. |
| F-04 | **Spacing scale** | 4px base: 1,2,3,4,6,8,12,16,24 — plus the three *density modes* below |
| F-05 | **Density modes** | `comfortable` (library screens) / `compact` (Live surface) / `touch` (if a tablet/stage-display client is ever built) |
| F-06 | **Radius scale** | none / sm / md / lg / pill / full |
| F-07 | **Elevation** | flat / hairline / raised / floating / modal — currently everything is hairline-only |
| F-08 | **Motion tokens** | durations (instant 80 / fast 140 / base 220 / slow 400), easings, and a `prefers-reduced-motion` path. Live-surface transitions must never exceed ~150ms. |
| F-09 | **Z-index ladder** | base → sticky header → popover → drawer → modal → toast → tour spotlight → output overlay |
| F-10 | **Icon set** | ~60 icons: play, stop, mic, mic-off, eye, eye-off, monitor, monitor-x, chevrons, plus, trash, edit, drag-handle, search, filter, check, x, alert, info, refresh, download, upload, cloud, cloud-off, qr, book, music, image, palette, calendar, user, settings, keyboard, wifi, wifi-off, lock, external-link, copy, more-horizontal, grid, list, arrow-up/down/left/right, skip-forward/back, clock, timer, sparkle (AI), waveform, projector, layers, link, unlink, star, flag, undo |
| F-11 | **Focus & keyboard** | visible focus ring spec, tab order rules, roving tabindex for lists/grids |
| F-12 | **Global shortcut map** | the whole keybinding table (see S-01 notes) — a design artifact, not just code |
| F-13 | **Sound/haptics** | optional: a soft confirm tick on GO LIVE. Decide yes/no. |
| F-14 | **Empty/loading/error voice** | the copy rules — how the app talks when it has nothing to show |
| F-15 | **Seasonal theming hooks** | which tokens are allowed to shift for Advent/Lent/Easter/Christmas without breaking contrast |

---

# PART 1 — PRIMITIVES (Layer 1)

Zero domain knowledge. Pure UI.

## Actions
| # | Component | Notes / variants |
|---|---|---|
| C-01 | **Button** | variants: solid, outline, text, ghost, danger, **live** (the red/black go-live volume); sizes: xs/sm/md/lg/xl; states: default, hover, active, focus, disabled, loading; optional leading/trailing icon; full-width |
| C-02 | **IconButton** | square/circle, all Button variants, requires `aria-label`, tooltip-on-hover built in |
| C-03 | **ButtonGroup** | joined buttons, shared borders |
| C-04 | **SegmentedControl** | 2–5 exclusive options (e.g. Preview/Live/Both, KJV/BBE/RVR) |
| C-05 | **SplitButton** | primary action + dropdown of variants (e.g. GO LIVE ▾ → "go live & hold") |
| C-06 | **ToggleButton** | pressed/unpressed, used in transport bar |
| C-07 | **Link** | internal + external (with external-link affordance) |

## Form controls
| # | Component | Notes |
|---|---|---|
| C-08 | **TextInput** | sizes, prefix/suffix slots, invalid state, char counter |
| C-09 | **TextArea** | auto-grow, max rows, monospace variant |
| C-10 | **NumberInput** | stepper buttons, min/max/step, unit suffix (ms, %, sec) |
| C-11 | **PasswordInput** | reveal toggle, "saved" masked state for API keys |
| C-12 | **SearchInput** | leading icon, clear button, `Kbd` shortcut hint, debounce |
| C-13 | **Select** | custom listbox (not native) so it can be styled + keyboard-navigated |
| C-14 | **Combobox** | typeahead + filter; the backbone of book search, song search, scene pickers |
| C-15 | **MultiSelect** | tokenized chips inside the field |
| C-16 | **Checkbox** | + indeterminate |
| C-17 | **CheckboxGroup** | |
| C-18 | **Radio / RadioGroup** | incl. "card radio" (rich option cards, e.g. ASR provider choice) |
| C-19 | **Switch / Toggle** | exists; needs sizes + loading state for async settings |
| C-20 | **Slider** | single + range; tick marks; used for trust gate, timeouts, font size |
| C-21 | **ColorPicker** | swatch grid + hex input (Themes) |
| C-22 | **FontPicker** | family + weight preview (Themes) |
| C-23 | **FileDropZone** | drag-drop + browse; images, media, sermon plans, schedules |
| C-24 | **Field** | exists; add error text, required marker, help popover |
| C-25 | **FormSection / Fieldset** | titled group with description |
| C-26 | **FormActions** | sticky save/cancel bar with dirty-state detection |

## Structure & layout
| # | Component | Notes |
|---|---|---|
| C-27 | **Panel / Card** | exists; add: header/body/footer slots, `variant: flat/raised`, `tone: default/live/warning` |
| C-28 | **PanelHeader** | exists; add: icon, subtitle, overflow menu, collapse toggle |
| C-29 | **SectionLabel** | exists |
| C-30 | **Toolbar** | left/center/right slots, overflow collapse |
| C-31 | **SplitPane** | draggable resizer, persisted sizes — the Live surface's 3 columns |
| C-32 | **ScrollArea** | styled scrollbars, fade edges, scroll-to-bottom pin (transcript) |
| C-33 | **Divider** | horizontal/vertical, optional label |
| C-34 | **Stack / Grid** | layout primitives so screens stop hand-rolling flex classes |
| C-35 | **Tabs** | underline + pill variants; horizontal + vertical (Settings sidebar) |
| C-36 | **Accordion / Disclosure** | Settings advanced sections |
| C-37 | **Breadcrumb** | Bible: Book › Chapter; Services archive |
| C-38 | **Wizard / Stepper** | first-run setup, cloud linking |
| C-39 | **AspectBox** | 16:9 / 4:3 container for every monitor & thumbnail |

## Data display
| # | Component | Notes |
|---|---|---|
| C-40 | **List / ListRow** | selectable, multi-select, keyboard nav, drag-reorder handle, inline actions on hover |
| C-41 | **Table** | sortable headers, sticky header, row selection, zebra off by default |
| C-42 | **DescriptionList** | key/value pairs (service detail, about) |
| C-43 | **Badge / Pill** | exists; add tones: neutral/live/preview/ok/warn/danger/ai |
| C-44 | **Chip** | removable token |
| C-45 | **Avatar / Monogram** | preacher initials |
| C-46 | **Kbd** | keyboard key rendering |
| C-47 | **CodeBlock** | for external-control docs / JSON config |
| C-48 | **CopyableText** | value + copy button + copied confirmation |
| C-49 | **RelativeTime** | "2m ago", live-ticking |
| C-50 | **Duration** | mm:ss / h:mm:ss elapsed |
| C-51 | **Stat** | big number + label + delta (Preachers, Cloud) |
| C-52 | **Sparkline** | tiny trend line (corrections over services) |
| C-53 | **ProgressBar** | determinate + indeterminate; used for model download |
| C-54 | **RadialProgress** | trust %, training completeness |
| C-55 | **Meter** | generic segmented meter (LevelMeter generalizes into this) |

## Feedback & overlays
| # | Component | Notes |
|---|---|---|
| C-56 | **Tooltip** | delay, placement, keyboard-accessible |
| C-57 | **Popover** | anchored, focus-trapped optional |
| C-58 | **Menu / DropdownMenu** | items, separators, submenus, checkable, destructive styling |
| C-59 | **ContextMenu** | right-click on list rows, media, slides |
| C-60 | **Modal / Dialog** | sizes, non-dismissible variant, focus trap |
| C-61 | **ConfirmDialog** | destructive confirmation (delete preacher, end service, wipe data) |
| C-62 | **Drawer / Sheet** | right-side inspector (slide editor, verse detail) |
| C-63 | **Toast + ToastProvider** | success/error/info; action slot ("Undo"); stacking |
| C-64 | **InlineAlert / Banner** | info/warn/error/success; dismissible; the DB banner + practice banner generalize into this |
| C-65 | **Spinner** | sizes |
| C-66 | **Skeleton** | text/rect/circle |
| C-67 | **EmptyState** | exists; upgrade to icon + title + description + action |
| C-68 | **ErrorState** | with retry + "copy diagnostics" |
| C-69 | **ErrorBoundary** | screen-level crash fallback |
| C-70 | **Spotlight** | dimmed cutout for the guided tour (currently in `Tour.tsx`) |
| C-71 | **CommandPalette** | ⌘K — jump to any verse/song/slide/setting. High leverage for operators. |

---

# PART 2 — DOMAIN COMPONENTS (Layer 2)

Trilorah-specific. These carry meaning.

## Engine & status
| # | Component | Notes |
|---|---|---|
| D-01 | **StatusDot** | idle/connecting/listening/error/stopped with pulse |
| D-02 | **AsrStatusCluster** | dot + label + level meter + detail line (currently inline in `App.tsx`) |
| D-03 | **LevelMeter** | exists; add vertical variant + peak hold + clip indicator |
| D-04 | **IntentIndicator** | idle → intent → reference → reading → commentary, as a 5-stage progression |
| D-05 | **ConfidenceBadge** | 0–1 as a readable confidence chip |
| D-06 | **TrustMeter** | exists as TrustBar; add gate marker label, eligibility state, tooltip breakdown |
| D-07 | **ModelDownloadCard** | whisper model download with progress + cancel |
| D-08 | **EngineOfflineNotice** | "running outside Electron" / engine crashed |
| D-09 | **ConnectionStatusRow** | reusable: OBS / vMix / Cloud / Companion — name, dot, latency, action |

## Scripture
| # | Component | Notes |
|---|---|---|
| D-10 | **VerseRef** | formatted reference text, canonical + localized |
| D-11 | **VerseRefInput** | book combobox + chapter + verse + end-verse, with validation |
| D-12 | **BookPicker** | 66 books, OT/NT grouped, searchable, keyboard-first |
| D-13 | **ChapterGrid** | numeric grid |
| D-14 | **VerseGrid** | numeric grid |
| D-15 | **VerseCard** | ref + serif text + version chip + actions (preview / live / queue / copy) |
| D-16 | **VerseList** | chapter reading view with verse numbers, current-verse highlight |
| D-17 | **VersionPicker** | translation switcher; shows which are installed vs importable |
| D-18 | **ScriptureSearchPanel** | exists as `ScriptureSearch.tsx`; formalize |
| D-19 | **VerseQueueList** | queued-for-later verses + reason + show-now |
| D-20 | **VerseDiff** | "heard X → proposed Y" for corrections |

## Live surface
| # | Component | Notes |
|---|---|---|
| D-21 | **PreviewMonitor** | 16:9 render of what *would* go live |
| D-22 | **ProgramMonitor** | 16:9 mirror of what *is* live, with LIVE badge |
| D-23 | **OutputRenderer** | the single shared renderer used by monitors *and* the real output window (one source of truth for what a slide looks like) |
| D-24 | **TransportBar** | the bottom control strip: listen/stop, preview→live, clear, black, logo, freeze, practice, end service |
| D-25 | **GoLiveButton** | oversized, unmistakable, keyboard-bound |
| D-26 | **ClearBlackLogoTriad** | the three "kill the screen" actions |
| D-27 | **TranscriptStream** | rolling transcript, auto-scroll w/ pin, detected refs highlighted inline |
| D-28 | **TranscriptLine** | one utterance + timestamp + entity marks |
| D-29 | **PulpitLog** | "heard from the pulpit" — voice commands + detections feed |
| D-30 | **VoiceCommandRow** | kind icon + utterance + value + time |
| D-31 | **OutputTargetBar** | one chip per connected display: name, resolution, open/close, identify |
| D-32 | **ServiceTimer** | elapsed since listening started + segment elapsed |
| D-33 | **SegmentBadge** | current segment type + confidence |
| D-34 | **SegmentTimeline** | horizontal service progress bar with segment blocks |
| D-35 | **ServiceOrderPanel** | the running order with current-item highlight, click to jump |
| D-36 | **PrayerModeOverlay** | full-surface calm state when prayer mode is on |
| D-37 | **PracticeBanner** | practice-mode indicator with scenario + stop |
| D-38 | **FreezeIndicator** | output frozen state |
| D-39 | **QrShowCard** | companion QR preview + push-to-output |
| D-40 | **MediaSuggestionToast** | engine-suggested background/media, accept/dismiss |

## Preachers & training
| # | Component | Notes |
|---|---|---|
| D-41 | **PreacherCard** | avatar, name, services, samples, trust meter, auto-eligible state |
| D-42 | **PreacherPicker** | active-preacher selector (also lives in Live) |
| D-43 | **TrainingProgressCard** | samples toward maturity, plateau state, "training paused/reopened" |
| D-44 | **AccuracyTrend** | precision over last N services (sparkline + table) |
| D-45 | **ReviewCard** | one review item: heard vs proposed, confirm / reject / amend |
| D-46 | **AmendRefEditor** | inline verse-ref correction |
| D-47 | **ReviewQueue** | end-of-service review flow with progress + "done" state |
| D-48 | **VoiceNoteRecorder** | short voice sample for a hard reference (product vision item) |
| D-49 | **MissLog** | historical misses table, filterable |

## Songs & presentation content
| # | Component | Notes |
|---|---|---|
| D-50 | **SongCard** | title, author, key, CCLI, slide count |
| D-51 | **SongList** | searchable library list |
| D-52 | **LyricsEditor** | sectioned lyrics (verse/chorus/bridge) with slide-break markers |
| D-53 | **SectionTag** | V1 / C / B / T tags |
| D-54 | **SlideThumb** | rendered slide thumbnail w/ index + selected/live state |
| D-55 | **SlideStrip** | horizontal filmstrip of a song/deck |
| D-56 | **SlideGrid** | grid view of a deck |
| D-57 | **ArrangementBuilder** | drag song sections into an order |
| D-58 | **MediaThumb** | image/video with duration + type badge |
| D-59 | **MediaGrid** | media library grid, multi-select |
| D-60 | **MediaInspector** | drawer: filename, dimensions, use-as-background actions |
| D-61 | **PresentationCard** | imported deck card |

## Themes & output design
| # | Component | Notes |
|---|---|---|
| D-62 | **ThemeCard** | live 16:9 preview + name + active state |
| D-63 | **ThemeEditor** | the whole editing surface |
| D-64 | **TypographyControls** | family, size, weight, line-height, alignment, max lines |
| D-65 | **BackgroundControls** | color / image / video / blur / dim overlay |
| D-66 | **TextShadowControls** | shadow, outline, glow — legibility on video |
| D-67 | **SafeAreaOverlay** | title-safe guides on the preview |
| D-68 | **LowerThirdEditor** | if lower-thirds ship |
| D-69 | **SeasonalThemeSelector** | Advent/Lent/Easter/Christmas variants + auto-switch toggle |

## Schedule
| # | Component | Notes |
|---|---|---|
| D-70 | **ScheduleEditor** | reorderable list of segments |
| D-71 | **ScheduleRow** | type, title, time, notes, preacher pin |
| D-72 | **SegmentTypePicker** | with custom-type entry |
| D-73 | **ScheduleImportCard** | OCR flyer import: pick image → parsed entries → unmatched lines → accept |
| D-74 | **ScheduleSuggestionCard** | "based on your last N services" with confidence + apply |
| D-75 | **TimeInput** | service start/end |

## Notes (AI)
| # | Component | Notes |
|---|---|---|
| D-76 | **NotesOutline** | live-building outline of the sermon |
| D-77 | **NotePointCard** | heading + explanation + scriptures |
| D-78 | **DefinitionRow** | term + definition |
| D-79 | **QuoteCard** | quoted line + attribution |
| D-80 | **ApplicationRow** | application bullet |
| D-81 | **NotesLiveIndicator** | "still writing…" streaming state |
| D-82 | **NotesExportBar** | PDF / Markdown / copy / push-to-cloud |
| D-83 | **NotesProviderBadge** | local vs cloud model, with status |

## Settings & system
| # | Component | Notes |
|---|---|---|
| D-84 | **SettingsNav** | vertical section nav |
| D-85 | **SettingRow** | label + description + control + "changed" indicator, in one consistent row |
| D-86 | **AudioDevicePicker** | device list + live level test |
| D-87 | **DisplayPicker** | detected monitors, assign output role, identify button |
| D-88 | **ObsSceneTester** | connect, list scenes, fire a test |
| D-89 | **VmixTester** | same for vMix |
| D-90 | **ExternalControlDocs** | ws endpoint + command table + copyable examples |
| D-91 | **VoiceCommandConfigEditor** | per-command phrase lists: defaults (read-only) + language pack + user additions, with add/remove |
| D-92 | **LanguagePicker** | ASR language + UI language |
| D-93 | **ThresholdControls** | every tunable gate (trust gate, auto-display timeout, batch interval, false-positive filter) with reset-to-default |
| D-94 | **ApiKeyField** | masked, validate, clear |
| D-95 | **DataPrivacyPanel** | what's stored locally, retention, wipe |
| D-96 | **UpdateCard** | version, check for updates, release notes |
| D-97 | **DiagnosticsPanel** | DB status, verse count, log path, copy diagnostics bundle |

## Cloud & companion
| # | Component | Notes |
|---|---|---|
| D-98 | **CloudAuthPanel** | sign in / sign up / signed-in state |
| D-99 | **AccountSetupCard** | church name + slug with availability check |
| D-100 | **LinkCodeCard** | generate code, countdown to expiry, regenerate |
| D-101 | **QrCard** | companion URL QR + copy link |
| D-102 | **ServiceHistoryList** | past services with date, preacher, verse count |
| D-103 | **AudienceStats** | live companion viewers count |
| D-104 | **GivingMethodsEditor** | Zelle/Venmo/CashApp/PayPal/bank/custom + note |
| D-105 | **SyncStatusRow** | write-behind queue depth, last synced, retry |

## Onboarding
| # | Component | Notes |
|---|---|---|
| D-106 | **TourSpotlight** | dimmed cutout + tooltip + step counter (exists in `Tour.tsx`) |
| D-107 | **TourTooltip** | body, next/back/skip |
| D-108 | **SetupWizardStep** | one step of first-run |
| D-109 | **ChecklistCard** | "finish setting up" with completion state |
| D-110 | **PracticeScenarioPicker** | choose a scripted sermon to rehearse against |

---

# PART 3 — DESKTOP SCREENS (every screen, every state)

## S-01 — App Shell
The frame everything lives in.
- **Regions:** title bar (Electron, macOS traffic-light inset) · brand · tab nav · status cluster · help/tour button · optional ⌘K
- **States:** engine connected / engine missing / engine crashed · update available · offline · practice mode active · prayer mode active
- **Also owns:** toast stack, modal root, command palette, global shortcut handling, error boundary

## S-02 — LIVE (the control surface)
The screen that matters. Currently one 696-line file; needs to be a composed layout.
- **Layout:** left = service order + preacher · center = preview + transcript · right = program output + queue + pulpit log · bottom = transport bar
- **Panels:** Service Order · Preacher · Preview (with intent pill) · Transcript · Live Output · Verse Queue · Pulpit Log · Transport Bar
- **States:**
  - S-02a idle / not listening
  - S-02b connecting (ASR handshake, model downloading)
  - S-02c listening, nothing detected
  - S-02d verse in preview (awaiting operator)
  - S-02e verse live
  - S-02f auto-mode live (trust gate passed — visually distinct from operator-pushed)
  - S-02g voice correction applied ("I said verse 34")
  - S-02h prayer mode
  - S-02i practice mode
  - S-02j output frozen / cleared / black / logo
  - S-02k media or QR on output
  - S-02l engine error
  - S-02m no output display connected
  - S-02n mic permission denied / no signal
- **Sub-screen:** **S-02R Service Review** — end-of-service review queue (heard vs proposed, confirm/reject/amend), progress, summary, "save & close service"

## S-03 — BIBLE
- Book picker → chapter grid → verse list; search bar; version picker
- **Sub-views:** browse · search results · verse detail · compare translations (side-by-side) · import a translation
- **States:** DB missing/corrupt · version not installed · no results · long chapter virtualization

## S-04 — SONGS
- **Sub-views:** library list · song detail (slides) · lyrics editor · arrangement builder · import (ChordPro / plain text / ProPresenter?) · CCLI fields
- **States:** empty library · search no-results · unsaved edits · song live now

## S-05 — MEDIA (currently "Presentations")
- **Sub-views:** media grid (images/video) · imported presentations · slide grid for a deck · media inspector drawer
- **States:** empty · importing (progress) · unsupported file · missing file on disk

## S-06 — THEMES
- **Sub-views:** theme gallery · theme editor (typography / background / shadow / safe area) · seasonal themes
- **States:** default theme (uneditable?) · unsaved changes · preview-on-output mode

## S-07 — SCHEDULE
- **Sub-views:** today's order editor · OCR flyer import flow (pick → parse → review unmatched → apply) · learned-suggestion card · saved templates
- **States:** empty · imported-with-unmatched-lines · suggestion available · schedule active/running

## S-08 — PREACHERS
- **Sub-views:** preacher list · preacher detail (stats, trust, training progress, accuracy trend) · miss log · voice notes · create/edit/delete
- **States:** no profiles · new profile (no data) · training in progress · plateaued (training auto-stopped) · accuracy dropped (training reopened) · auto-mode eligible

## S-09 — NOTES
- **Sub-views:** live notes (building during sermon) · finished notes · export
- **States:** no sermon yet · streaming/building · generating (model working) · complete · generation failed · local model not downloaded

## S-10 — SETTINGS
One screen, vertical nav, many pages:
- S-10a **Church** — name, logo, slug, campus
- S-10b **Audio & Speech** — input device, level test, ASR provider (whisper-local / Deepgram), model, download manager
- S-10c **Language** — ASR language, UI language, language packs
- S-10d **Detection & Trust** — trust gate slider, auto-display timeout, false-positive filter, slow path, batch interval, per-threshold reset
- S-10e **Voice Commands** — full phrase editor per command kind
- S-10f **Displays & Output** — monitor assignment, identify, resolution, safe area, default theme
- S-10g **Streaming** — OBS (host/port/password/connect/scene test), vMix
- S-10h **External Control** — Stream Deck / Companion ws docs, command table, port
- S-10i **Giving** — all giving methods + note
- S-10j **Cloud & Sync** — account, sync status, retention
- S-10k **Privacy & Data** — what's stored, wipe transcript, wipe profiles, export data
- S-10l **Advanced** — logs, DB status, rebuild index, developer flags
- S-10m **About & Updates** — version, licenses, check for updates

## S-11 — CLOUD
- **Sub-views:** signed-out (sign in / sign up) · account setup (church name + slug) · dashboard (services, notes, audience) · link code manager · companion QR · service history · service detail
- **States:** not configured · configured but signed out · signed in, no account · signed in, account complete · sync failing · project paused/unreachable

## S-12 — First-Run Setup Wizard *(new)*
Steps: welcome → church name → microphone + level test → speech engine (local vs cloud) + model download → output display assignment → preacher profile → optional cloud link → "start practice" handoff

## S-13 — Guided Tour Overlay
14-step spotlight (exists). Needs: step list as data, replay entry point, per-screen anchoring.

## S-14 — Practice Mode
Scenario picker → scripted sermon replay → live surface with practice banner → results summary ("would have shown 12 verses, 2 misses")

## S-15 — Command Palette (⌘K)
Verse jump, song jump, slide jump, setting jump, action run.

## S-16 — Error / Crash Screen
Engine dead, DB corrupt, unhandled render error — with copy-diagnostics and restart.

## S-17 — Update Screen
Downloading / ready to install / release notes.

---

# PART 4 — PROJECTOR OUTPUT WINDOWS

What the congregation sees. Separate renderer (`src/output.tsx`), separate design rules
(large type, high contrast, no chrome, no animation that flickers on camera).

| # | Screen | Notes |
|---|---|---|
| O-01 | **Scripture slide** | ref + text + version, theme-driven, auto-fit long passages, multi-verse pagination |
| O-02 | **Song/lyrics slide** | section-aware |
| O-03 | **Media slide** | image/video fill, ken-burns optional |
| O-04 | **Clean / black** | |
| O-05 | **Logo / holding slide** | |
| O-06 | **QR companion slide** | |
| O-07 | **Lower third** | if shipped |
| O-08 | **Countdown / pre-service** | timer to service start |
| O-09 | **Announcement slide** | from schedule |
| O-10 | **Stage display** *(future)* | preacher-facing: current verse, next item, timer, notes |
| O-11 | **Transitions** | cross-fade spec between all of the above |

---

# PART 5 — WEB COMPANION (Next.js, `web/`)

## Congregation-facing (`/live/[slug]`)
| # | Screen | Notes |
|---|---|---|
| W-01 | **Companion shell** | church branding, connection state, tab bar |
| W-02 | **Verses tab** | live verse stream, tap to expand, copy/share |
| W-03 | **Notes tab** | live-building sermon notes |
| W-04 | **Give tab** | giving methods as tappable actions |
| W-05 | **Correction overlay** | (exists) |
| W-06 | **Not-found / service-not-live** | |
| W-07 | **Offline / reconnecting** | |

## Church admin (`/app`)
| # | Screen | Notes |
|---|---|---|
| W-08 | **Marketing / landing** | `/` |
| W-09 | **Sign up** | |
| W-10 | **Sign in** | |
| W-11 | **Finish setup** | church name + slug |
| W-12 | **Dashboard** | QR card, link codes, recent services |
| W-13 | **Services archive** | |
| W-14 | **Service detail** | transcript, verses, notes |
| W-15 | **Notes detail / export** | |
| W-16 | **Team / campuses** | |
| W-17 | **Account settings** | password, sign out all devices, retention |

---

# PART 6 — CROSS-CUTTING STATE MATRIX

Every screen must have a defined design for each of these. This is where UIs usually rot.

1. **Loading** (first paint) — skeleton, not spinner, wherever shape is known
2. **Empty** (no data yet) — icon + one line + one action
3. **No results** (filter/search) — distinct from empty
4. **Error** — with retry
5. **Offline / engine disconnected**
6. **Permission denied** (mic, file access)
7. **Partial data** (verse ref known, text still fetching)
8. **Optimistic / pending** (setting saving)
9. **Stale** (cloud data older than N)
10. **Destructive confirm**
11. **Unsaved changes guard**
12. **Long content** (virtualization, truncation, overflow)
13. **Live-critical** (never block the operator with a modal while a service is running)

---

# PART 7 — SUGGESTED BUILD ORDER

1. **F-01 → F-15** — foundations. Nothing else starts first.
2. **C-01 … C-39** — actions, forms, layout. Unblocks Settings entirely.
3. **C-40 … C-71** — data display, overlays, feedback.
4. **D-01 … D-20** — engine status + scripture. Unblocks Bible + Live core.
5. **D-21 … D-40** — the Live surface. Highest risk, highest value.
6. **O-01 … O-11** — output windows, sharing `OutputRenderer` (D-23) with the monitors.
7. **D-41 … D-110** — the library screens' domain components.
8. **S-01 … S-17** — assemble desktop screens.
9. **W-01 … W-17** — web companion, reusing tokens (not React components — different runtime).

---

## Counts

- **15** foundation decisions
- **71** primitives
- **110** domain components
- **17** desktop screens (with ~60 named sub-views/states)
- **11** output surfaces
- **17** web screens

**≈ 181 components, ≈ 45 screens.**
