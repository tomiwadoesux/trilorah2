# Trilorah product guide map

This map connects user tasks to the current Trilorah interface, supporting code, prerequisites, completion signals, and known gaps. It is the foundation for a guide that understands a request, opens the right area, highlights controls, and follows the user's progress.

The first pass covers **59 task families across 22 areas** of the desktop app, phone experiences, and website. It reflects package version **0.4.7** and the working tree reviewed on **October 10, 2026**, including existing uncommitted work. It does not certify the installed or deployed release.

- [Product map](product-map.json): the maintained task records and source references.
- [Source snapshot](source-snapshot.json): fingerprints used to detect changes since review.
- [Change checker](../../scripts/check-product-map.mjs): validates records and flags changed source areas and affected tasks.

## What is ready

There are 46 tasks with UI and supporting code paths, 11 partial tasks with known gaps, and 2 surfaces needing deeper verification. Every full task record retains `runtimeTested: false` and `guideReady: false`: end-to-end hardware and service behavior has not been certified. The interactive guide preview and its isolated microphone demo have been exercised in the running desktop app; this is tracked separately in `guideImplementation`.

Each task records its entry point, controls, prerequisites, observable completion signals, limitations, and evidence files. Task IDs identify searchable help entries. Microphone guide anchors now bind to actual controls; IDs alone are not permission to perform an action. `wired` means a code path was found; it is not a release-readiness guarantee.

The current desktop entry is `App` → `LiveHost` → `LiveScreen`. Although `LiveScreen` is under `src/design`, it is the active product surface. Some older modules, including Cloud and Themes, are still embedded in current Settings. The old search registry's route strings are not authoritative navigation destinations.

## Try the companion

Open **i guide** at the top right. Choose **Show me** for visible registered clicks or typing, or **I’ll do it** for pointing and manual control. The small caption bubble follows the triangle; every new real-app step asks before acting. User takeover freezes the cursor and cancels pending typing/clicks.

- **Prepare a service:** open programme entry, edit the example in the guide, type it into the app, then read it into review. Applying rows is a separate user action.
- **Find an online image:** supply search words or choose a suggestion. If no provider key is present, the guide opens API keys Settings and waits for a saved Pixabay/Pexels provider before returning to the retained search. The user enters the secret. Provider acceptance is only known after an actual search.
- **Find a Bible passage:** type a supplied reference, then choose a verse to preview. The guide never presses Enter or double-clicks a verse.
- **Set up a screen:** open Dashboard Outputs, choose the display yourself, and check the physical screen.
- **Add pictures or video:** open Media/local files and locate Add from laptop. Native file selection stays with the user.
- **Add a song:** open the editor and focus or type supplied title/lyrics; keep existing drafts and save explicitly.
- **Connect a microphone:** the existing isolated demo remains available. Real capture requires the user’s source/listening choice and fresh audio plus transcript evidence.

Follow-up search finds another mapped task without executing an ambiguous request. The map includes 59 task families across 22 areas. Topics without registered workflows offer navigation and quick help; this is not a universal language-model agent.

The runner re-finds visible controls, checks enabled state and occlusion, then animates toward current bounds with a distance-aware 400–850 ms deceleration. Click feedback lasts 500 ms. Reduced motion removes travel. Nonempty programme and song drafts are preserved; reference and image query fields can be replaced by the user-requested query. Password fields are never writable by the guide.

### Verification

The current browser preview was exercised through real component navigation, programme typing, parsing into five review rows, typo-tolerant screen follow-up, expanded Outputs and its display picker, Online navigation and the missing-desktop message. The source index refreshes after changes and an active guide pauses with an update message. The previous desktop checks covered the microphone demo and song-editor interaction. Hardware assignment, real credential saving/authenticated provider search and real microphone capture remain separate release checks.

Focused tests cover task discovery, action boundaries, typing-target restrictions, prerequisite recovery and unknown-state handling. The programme parser has its existing regression suite. A build emits `dist/guide-index.json` without user values or secrets.

## Automatic refresh and remaining scope

`vite.config.ts` loads `scripts/guideIndex.ts`. It watches app source and the task map, generates a fresh source revision/control inventory, and notifies an active guide to pause after updates. A broader HMR remount may close the guide; reopen it to use the new code. Production gets a new index on every build. Actual target locations are queried each time, not saved as coordinates.

A newly added feature still needs reviewed steps, prerequisites and completion conditions. The source index does not infer these meanings. The separate semantic-map checker remains conservative and flags drift for review; it never silently marks changed workflows verified.

No credential, sermon transcript or user media belongs in the source map. General language-model reasoning, complete execution of every task family, website integration and cross-platform/hardware verification remain future work.

## Important findings

- **Scripture publication is explicit.** Spoken catches can stage suggestions, but the runtime blocks automatic projection. Typing a reference and pressing Enter, or selecting a phrase-search result, can send scripture live immediately. A guide must identify these as publication actions.
- **Audio is observable in stages.** Available input, selected input, phone connection, audio signal, listening state, and transcript arrival are different signals. A successful connection does not prove transcription works.
- **Practice is not complete output isolation.** The practice sermon feeds simulated recognition text into the real downstream recognition flow. Do not advertise it as a separate safe sandbox for every action.
- **Several current settings are incomplete.** Connected, Companion, and Giving use rows without persistence/action wiring. Pixabay/Pexels entry is wired; other generic credential controls remain presentational. Several Settings action buttons, including data maintenance and Identify, have no action handler. The Dashboard Outputs path is separately wired.
- **Recognition labels can be outdated.** Auto-mode thresholds and descriptive settings text do not override the engine's manual-only publication gate.
- **Full notes are not currently an offline promise.** The experimental local provider delegates full note generation to cloud. The generic Hugging Face key control still has a provisioning gap.
- **Some run shortcuts are unfinished.** The run-header Add media and Add note items have no matching action in their selection handler. The separately mapped segment note/queue paths have their own wiring.
- **The website example assistant is a demonstration.** The current uncommitted `/home` example uses local response rules. It is not the conversational guide or a desktop-control connection.
- **Integration backends do not prove usable setup flows.** OBS/vMix code exists, but the current Connected settings surface has wiring gaps. Verify its setup workflow before offering an executable guide.

## Keep the map current with app changes

Run the check from the repository root:

```sh
node scripts/check-product-map.mjs
```

The check validates required fields, unique IDs, and evidence-file existence. It compares fingerprints of the evidence files and watched source groups. A changed evidence file names the task records to revisit. A change elsewhere in a watched group asks for a broader review, which helps catch newly added features that have no task yet. This is deliberately conservative: a cosmetic edit can also flag an area.

When a change affects navigation, controls, prerequisites, behavior, errors, or results:

1. Read the changed code and inspect the resulting UI when needed.
2. Update affected task records, examples, and limitations. Add tasks for new features and retire removed ones.
3. Update the guide's anchors/actions and verify the relevant walkthroughs. Keep source-reviewed and runtime-tested status distinct.
4. Refresh screenshots or recordings when their visible controls or explanations changed.
5. After review, record the new source snapshot and check again:

```sh
node scripts/check-product-map.mjs --snapshot-after-review
node scripts/check-product-map.mjs
```

Do not refresh the snapshot merely to hide a failing check. The refresh records a baseline; it does not understand or correct the documentation.

Exit status is 0 for unchanged valid sources, 1 when source drift needs review, and 2 for invalid records, missing evidence, or other check errors. Code/style files in the declared roots and explicitly listed configuration files are watched. Tests, generated outputs, binary assets, external service behavior, hardware, and deployment state are not certified by this check.

A development watcher and build index are installed. No recurring external monitor, automatic article writer or publication schedule has been installed. Review task semantics in the same change as product behavior.

## Task coverage

The entry points below summarize the map. Read each full JSON record before implementing a guide; prerequisites, completion checks, and limitations materially affect the steps.

<!-- Generated from product-map.json task titles, status, and entry fields. -->

### Audio

| Task | Status | Entry point |
| --- | --- | --- |
| Choose a microphone or soundboard input | wired | Audio menu beneath the operator preview; existing notification destination audio |
| Use a phone as the microphone | wired | Audio beneath the operator preview -> phone (over wi-fi), or notification destination phone |
| Practice scripture recognition without a microphone | wired | Audio beneath the operator preview -> practice sermon (no microphone), then Start listening |
| Start or stop listening to the service | wired | Operator footer listening control |
| Find why the app cannot hear speech | wired | Audio problem notice -> Choose audio input; header audio menu |

### Cloud

| Task | Status | Entry point |
| --- | --- | --- |
| Sign in, finish church setup, and link another computer | wired | Settings > Account & cloud; notification target cloud |
| Start and end congregation sharing | wired | Settings > Account & cloud > cloud service controls; paired phone remote > Online |

### Companion

| Task | Status | Entry point |
| --- | --- | --- |
| Configure companion access, stream link, and audience options | partial | Dashboard > Companion > expanded settings |
| Show or share the congregation QR code | wired | Dashboard > Companion, or header Mobile tools > Stream |
| Configure giving methods shown to the congregation | partial | Dashboard > Giving |

### Dashboard

| Task | Status | Entry point |
| --- | --- | --- |
| Set, run, pause, extend, and display a service timer | wired | Dashboard > service timer; notification target timers |

### Integrations

| Task | Status | Entry point |
| --- | --- | --- |
| Configure OBS, vMix, or external command devices | partial | Dashboard > Connected; notification target connections |

### Media

| Task | Status | Entry point |
| --- | --- | --- |
| Find stock images or videos | wired | Online library tab → search → choose result |
| Import and preview local media | wired | Media → Add from laptop or Finder drop → choose media card |

### Navigation

| Task | Status | Entry point |
| --- | --- | --- |
| Find a library | wired | Operator posture → verses, themes, songs, slides, media, or online tab |
| Search for a feature or guide | partial | Search IPC over command registry; current UI guide entry not established |
| Understand a service issue and open its controls | wired | Header Notifications, or the dashboard notification list |

### Notes

| Task | Status | Entry point |
| --- | --- | --- |
| Review, generate, and export sermon notes | partial | Dashboard -> Sermon notes; existing notification destination notes |

### Output

| Task | Status | Entry point |
| --- | --- | --- |
| Clear and restore projected words | wired | Operator LIVE panel > clear/restore |
| Send prepared content live | wired | Operator preview → Go live |
| Assign projector, stream, stage, or timer outputs to displays | wired | Dashboard > Outputs > select display / expand tile |
| Configure stream layout and stage-screen information | wired | Settings > Displays & output; notification target displays |

### Preachers

| Task | Status | Entry point |
| --- | --- | --- |
| Create a preacher profile and select who is preaching today | wired | Profile view / preachers panel |
| Review catches, correct mistakes, and report missed references | wired | Profile -> sound check & review -> Recognition review |
| Run a preacher sound check | wired | Profile view -> choose preacher -> sound check & review |
| Teach recurring book-name mistakes and familiar vocabulary | wired | Profile -> choose preacher -> teaching |

### Remote

| Task | Status | Entry point |
| --- | --- | --- |
| Display and dismiss a short screen message | wired | Paired mobile remote > screen message controls |
| Pair, approve, and revoke a mobile remote | wired | Header Mobile tools > Mobile remote; notification target remote |
| Operate scripture, songs, media, and slides from a paired phone | wired | Paired mobile-remote page > content areas and preview/live dock |

### Run

| Task | Status | Entry point |
| --- | --- | --- |
| Build or edit an order of service | wired | Run rail → plus → Add segment; segment context menu for edits |
| Run header media/note shortcuts | partial | Run header plus → add media / add note tiles |
| Build a run from a programme | wired | Empty run rail Scan image/Paste or header plus → review → Add |
| Queue content or notes in a segment | wired | Drag supported library content onto a run segment; segment plus → note |

### Scripture

| Task | Status | Entry point |
| --- | --- | --- |
| Change the service Bible translation | wired | Verses → translation selector |
| Find and preview a Bible passage | wired | Operator → verses → reference input or verse row |
| Recognize a spoken scripture and send it live | wired | Operator view -> listening, catches and preview/live controls |
| Find scripture from a remembered phrase, person, event, or topic | wired | Operator -> verses -> second search field |
| Find the passage the preacher just mentioned | wired | Operator catches actions -> find scripture |

### Service Files

| Task | Status | Entry point |
| --- | --- | --- |
| Save, open, or transfer a service | wired | Run header or empty rail → .tri → desired file action |

### Settings

| Task | Status | Entry point |
| --- | --- | --- |
| Inspect local data and access export, deletion, and troubleshooting tools | partial | Settings > Privacy & data; notification target storage |
| Understand recognition settings and operator control | partial | Settings > Preacher AI |
| Change the operator appearance and default scripture font | wired | Dashboard > change appearance, or Settings > Appearance |
| Set church identity | partial | Settings > Church |
| Find a settings page | wired | Settings > find a setting |
| Configure service provider credentials | partial | Settings > API keys; Deepgram is under Audio & speech |

### Slides

| Task | Status | Entry point |
| --- | --- | --- |
| Create an announcement slide | wired | Slides → Quick slide → enter title/subtitle/body → save |
| Import a presentation | wired | Slides → Import slides → choose PPTX/PPT/ODP |

### Songs

| Task | Status | Entry point |
| --- | --- | --- |
| Create or edit lyric slides | wired | Songs → Add song or edit an existing song → editor |
| Find online lyrics and add a song | wired | Songs → Search online → search or YouTube route → review editor → save |
| Find a saved song | wired | Songs → search by song name or lyrics |
| Preview or display a song section | wired | Songs → open saved song → lyric section |

### Speech

| Task | Status | Entry point |
| --- | --- | --- |
| Choose and configure speech recognition | partial | Settings -> Audio & speech; existing destination speech -> S-10b |
| Set the spoken language and default Bible | wired | Settings -> Language; existing destination language -> S-10c |

### Themes

| Task | Status | Entry point |
| --- | --- | --- |
| Adjust readability and layout | wired | Themes library tab |
| Place media behind words | wired | Media → themes shelf → choose background, or drag media onto preview |

### Web Admin

| Task | Status | Entry point |
| --- | --- | --- |
| Use website account and service history | unverified | /app, /app/signup, /app/dashboard, /app/services, /app/services/[id] |

### Web Companion

| Task | Status | Entry point |
| --- | --- | --- |
| Follow a service's transcript, verses, notes, and giving information | wired | Public church QR/link > /live/[slug] |
| Customize reading appearance on a congregation phone | wired | Public companion > Reading options |

### Web Marketing

| Task | Status | Entry point |
| --- | --- | --- |
| Explore the website product examples | unverified | /home > example workflow prompts; root / has account links |

