# Editorial notes: visuals, evidence, and remaining checks

Updated October 11, 2026 for the rewritten 16 articles. These records combine current source review and the rewrite findings. Runtime checks and actual screenshot/clip production remain pending. No new hardware or provider walkthrough was performed by this content rebuild.

Use real UI and original rehearsal material. Do not expose secrets, active pairing codes, personal paths or private sermon content. Clips need captions and a written equivalent. The [publishing plan](brand-plan.md) determines editorial timing; a ready guide should be available when its feature is available.

<a id="01"></a>
## 01 · Meet Trilorah: ready for the next part of the service

[Read draft](articles/01-meet-trilorah.md) · Introduction · Awareness

**Legacy proposed date:** 2026-03-02 — a requested planning date, not publication history.

**Question:** What does Trilorah do, and where should our team begin?

**Implemented task coverage:** `navigation.open-library`, `run.build-edit`, `scripture.catch-and-project`, `output.publish-preview`.

**Evidence:** Current run of show uses section cards. LiveBody and the library tabs establish the workspace. Recognized scripture suggestions require an explicit operator/remote publication action; configured voice commands are separate.

Sources: [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx), [src/design/screens/run/RunRail.tsx](../../src/design/screens/run/RunRail.tsx), [electron/engine/verseDelivery.ts](../../electron/engine/verseDelivery.ts).

**Visuals:**

1. Operator workspace with a short synthetic run, library tabs, preview, and live all visible. Add four small labels; keep their UI names unchanged. Proposed alt text: “Trilorah operator workspace showing a service run, content libraries, preview, and live output.”
2. Optional 20–35 second captioned clip of one real spoken reference appearing as a candidate, followed by a deliberate operator send. Label the recording as a demonstration. Proposed alt text: “A spoken reference becomes a suggestion before the operator sends it live.”

**Before publication:** Walk the four-item sample service in the release desktop build. Confirm the current tab labels and explicit publication behavior. Do not use the website example assistant as proof of desktop capability.

**Rewrite review:** [rewrite-review-01-08.md](rewrite-review-01-08.md).

<a id="02"></a>
## 02 · Your first Trilorah service starts with a rehearsal

[Read draft](articles/02-first-service-checklist.md) · Checklist · Implementation

**Legacy proposed date:** 2026-03-05 — a requested planning date, not publication history.

**Question:** What should I check before using Trilorah in a service?

**Implemented task coverage:** `outputs.assign`, `run.build-edit`, `output.publish-preview`, `output.clear-restore`, `audio.choose-input`, `files.save-open-transfer`.

**Evidence:** OutputsTile assigns jobs/displays; Add a section and Add items build the practice run; Notes/Add note stores cues. MicPicker selects audio. Verse rows and reference submission have distinct preview/direct-send behaviour. Initial .tri save precedes autosave.

Sources: [src/design/screens/dashboard/OutputsTile.tsx](../../src/design/screens/dashboard/OutputsTile.tsx), [src/components/MicPicker.tsx](../../src/components/MicPicker.tsx), [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx), [src/design/screens/run/TriPackageActions.tsx](../../src/design/screens/run/TriPackageActions.tsx), [src/design/screens/run/RunHeaderActions.tsx](../../src/design/screens/run/RunHeaderActions.tsx), [src/design/screens/run/RunRail.tsx](../../src/design/screens/run/RunRail.tsx), [src/design/screens/run/RunContentPicker.tsx](../../src/design/screens/run/RunContentPicker.tsx).

**Visuals:**

1. Dashboard Outputs with a real connected rehearsal display and its job/display controls. Use a generic device label where possible. Proposed alt text: “Output job and display choices in Trilorah.”
2. Operator workspace during a prepared four-item practice service. Use the article checklist beside the image rather than a screenshot of a checklist. Proposed alt text: “A practice service containing a welcome, song, scripture, and closing slide.”

**Before publication:** Rehearse on actual hardware. Verify clear/restore and initial save. The practice sermon is not an isolated output sandbox; all sample live actions belong in rehearsal.

**Rewrite review:** [rewrite-review-01-08.md](rewrite-review-01-08.md).

<a id="03"></a>
## 03 · Connect a microphone and check it in Trilorah

[Read draft](articles/03-connect-a-microphone.md) · Tutorial · Implementation

**Legacy proposed date:** 2026-03-09 — a requested planning date, not publication history.

**Question:** How do I select the right microphone and confirm that transcription works?

**Implemented task coverage:** `audio.choose-input`, `audio.start-stop-listening`, `audio.troubleshoot`, `audio.phone-microphone`.

**Evidence:** MicPicker selects input and can restart listening. PhoneMicPanel separates Allow microphone approval from Use phone audio, which selects that source and starts listening. UI state can update before backend startup finishes; check fresh level and words.

Sources: [src/components/MicPicker.tsx](../../src/components/MicPicker.tsx), [src/lib/micCapture.ts](../../src/lib/micCapture.ts), [src/components/PhoneMicPanel.tsx](../../src/components/PhoneMicPanel.tsx), [src/design/screens/engine.tsx](../../src/design/screens/engine.tsx).

**Visuals:**

1. Open Audio beneath preview with the intended device selected; mask personal device names if necessary. Proposed alt text: “The Audio menu with a microphone selected.”
2. A single cropped view containing the responding audio level and fresh sample transcript from the same sentence. Optionally record this check with captions. Proposed alt text: “Audio activity and new transcript words during a microphone check.”

**Before publication:** Run a real input and transcription test; if showing phone steps, pair a test phone and verify use phone audio separately. Exclude live pairing codes from the published image. No engine-key provisioning tutorial is asserted.

**Rewrite review:** [rewrite-review-01-08.md](rewrite-review-01-08.md).

<a id="04"></a>
## 04 · How Trilorah finds scripture while the preacher speaks

[Read draft](articles/04-how-scripture-recognition-works.md) · Feature explanation · Consideration / implementation

**Legacy proposed date:** 2026-03-13 — a requested planning date, not publication history.

**Question:** How do spoken references and quotations become scripture suggestions, and who controls projection?

**Implemented task coverage:** `scripture.catch-and-project`, `scripture.recent-speech-search`, `scripture.phrase-topic-search`, `preacher.review-recognition`.

**Evidence:** main.ts stages detections with manualOnly and rejects enabling auto mode. VerseDelivery blocks automatic promotion of scripture suggestions. QuoteMatcher indexes KJV/BSB wording. ScriptureCatches result selection directly publishes. Configured voice commands are a separate screen-control path.

Sources: [electron/main.ts](../../electron/main.ts), [electron/engine/verseDelivery.ts](../../electron/engine/verseDelivery.ts), [electron/engine/quoteMatcher.ts](../../electron/engine/quoteMatcher.ts), [src/design/screens/ScriptureCatches.tsx](../../src/design/screens/ScriptureCatches.tsx).

**Visuals:**

1. A real captured reference with the transcript clue and candidate reference visible. Caption the example and tested Bible translation. Proposed alt text: “A spoken Bible reference and its suggested passage in Trilorah.”
2. Two frames from the same test: candidate in preview, then the chosen verse live after the operator press. A short captioned clip is preferable if available. Proposed alt text: “The operator checks the candidate before sending the verse live.”

**Before publication:** Record explicit-reference and quotation examples on the release build. If a quotation example does not match, show the failure/fallback or choose a verified example; do not fake the UI. Reconfirm auto-mode prohibition before publishing.

**Rewrite review:** [rewrite-review-01-08.md](rewrite-review-01-08.md).

<a id="05"></a>
## 05 · Get Trilorah onto the right screens

[Read draft](articles/05-connect-the-right-screens.md) · Tutorial · Implementation

**Legacy proposed date:** 2026-03-20 — a requested planning date, not publication history.

**Question:** How do I assign an output to a connected display and verify it?

**Implemented task coverage:** `outputs.assign`, `outputs.preferences`, `output.publish-preview`, `output.clear-restore`.

**Evidence:** OutputsTile.rowsFor provides job/display handlers; fromEngine.saveRole/saveDisplay persists choices. ROLE_SHOWS describes projector/stream/stage/timer. Settings exposes layout preferences rather than the effective display assignment workflow.

Sources: [src/design/screens/dashboard/OutputsTile.tsx](../../src/design/screens/dashboard/OutputsTile.tsx), [src/design/screens/dashboard/outputs/fromEngine.ts](../../src/design/screens/dashboard/outputs/fromEngine.ts), [src/design/screens/dashboard/outputs/types.ts](../../src/design/screens/dashboard/outputs/types.ts), [src/design/screens/Settings.tsx](../../src/design/screens/Settings.tsx).

**Visuals:**

1. Expanded Dashboard Outputs showing actual connected hardware, job selector, display selector, and status. Proposed alt text: “A projector output assigned to a connected display.”
2. Photo of a real rehearsal screen showing an original Projector check slide; exclude people unless appropriately arranged. Proposed alt text: “The test slide on the physical display used for the service.”

**Before publication:** Test screen assignments and no-screen/off on real hardware. Never substitute design.html sample screens. A stream role does not prove an external broadcast is configured.

**Rewrite review:** [rewrite-review-01-08.md](rewrite-review-01-08.md).

<a id="06"></a>
## 06 · Build a service another volunteer can run

[Read draft](articles/06-build-an-order-of-service.md) · Tutorial · Implementation

**Legacy proposed date:** 2026-03-27 — a requested planning date, not publication history.

**Question:** How do I organize segments, content, and notes for a service?

**Implemented task coverage:** `run.build-edit`, `run.queue-content-note`, `files.save-open-transfer`.

**Evidence:** Current run of show provides Add a section, section menus, Add items, saved song sections, file import, Verse and Notes/Add note. Default run replacement has confirmation. The older header-media/note limitation describes superseded UI.

Sources: [src/design/screens/run/RunHeaderActions.tsx](../../src/design/screens/run/RunHeaderActions.tsx), [src/design/screens/run/RunRail.tsx](../../src/design/screens/run/RunRail.tsx), [src/design/screens/run.tsx](../../src/design/screens/run.tsx), [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx), [src/design/screens/run/RunContentPicker.tsx](../../src/design/screens/run/RunContentPicker.tsx), [src/design/screens/run/ContextMenu.tsx](../../src/design/screens/run/ContextMenu.tsx), [shared/runCards.ts](../../shared/runCards.ts).

**Visuals:**

1. Current run of show with Add a section and prepared section cards, using an original rehearsal service. Proposed alt text: “A prepared service with sections and their content in Trilorah.”
2. Open section Add items picker at Notes, followed by the saved operator cue. Preserve enough surrounding UI to locate the action. Proposed alt text: “Adding an operator note to a service section.”

**Before publication:** Exercise Add a section, a saved song section, imported visual, Notes/Add note, reordering, default-run replacement confirmation, and save/reopen in the current release build.

**Rewrite review:** [rewrite-review-01-08.md](rewrite-review-01-08.md).

<a id="07"></a>
## 07 · Get the lyrics right before the first song

[Read draft](articles/07-prepare-song-lyrics.md) · Tutorial · Implementation

**Legacy proposed date:** 2026-04-07 — a requested planning date, not publication history.

**Question:** How do I add a song, organize its sections, and preview the words?

**Implemented task coverage:** `songs.create-edit-slides`, `songs.find-local`, `songs.preview-display-section`, `songs.discover-online`.

**Evidence:** SongEditor organizes sections and saves. SongLyricsEntry provides input. AddSongDialog opens online material into an editor. SongSheet separates Preview section and go live.

Sources: [src/design/screens/songs/SongEditor.tsx](../../src/design/screens/songs/SongEditor.tsx), [src/design/screens/songs/SongLyricsEntry.tsx](../../src/design/screens/songs/SongLyricsEntry.tsx), [src/design/screens/songs/AddSongDialog.tsx](../../src/design/screens/songs/AddSongDialog.tsx), [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx).

**Visuals:**

1. Song editor with original short training lyrics showing a useful split boundary and save control. Proposed alt text: “A song editor with lyric sections and a save control.”
2. The saved song section cards showing preview and go live as different actions. Optional split/reorder clip. Proposed alt text: “Saved lyric cards with separate preview and live controls.”

**Before publication:** Create/save/reopen a song, split a long section, and test preview then send during rehearsal. Online results require review and save. Do not use a copyrighted full lyric as sample documentation.

**Rewrite review:** [rewrite-review-01-08.md](rewrite-review-01-08.md).

<a id="08"></a>
## 08 · Add images and videos to Trilorah

[Read draft](articles/08-use-images-and-videos.md) · Tutorial · Implementation

**Legacy proposed date:** 2026-04-17 — a requested planning date, not publication history.

**Question:** How do I import media, find online visuals, and decide how they should appear?

**Implemented task coverage:** `media.import-preview-local`, `media.find-online`, `themes.change-background`, `output.publish-preview`.

**Evidence:** Current Media/Online routes distinguish standalone media and backgrounds. StockCredential persists Pixabay/Pexels keys and states that an actual search tests provider acceptance. Stock selection awaits download. Theme double-click and LIVE background drop can affect live output.

Sources: [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx), [src/design/screens/stockSearch.tsx](../../src/design/screens/stockSearch.tsx), [src/design/screens/mediaLibrary.ts](../../src/design/screens/mediaLibrary.ts), [src/lib/backgroundDrop.ts](../../src/lib/backgroundDrop.ts), [src/design/screens/Settings.tsx](../../src/design/screens/Settings.tsx), [src/design/screens/settingsRows.tsx](../../src/design/screens/settingsRows.tsx), [src/design/screens/StockCredential.tsx](../../src/design/screens/StockCredential.tsx).

**Visuals:**

1. Media library with one original local example and its standalone preview. Proposed alt text: “An imported picture selected as standalone media in preview.”
2. The same visual behind original text using the themes shelf; label preview and live only where they actually appear. Optional 10–15 second preview drop clip. Proposed alt text: “An image used as a background behind words in preview.”
3. Optional current Settings API keys provider row with no secret exposed; retain the note that a successful search checks key acceptance. Proposed alt text: “Provider setup and the reminder to check the key with a search.”

**Before publication:** Test local import, download, provider failure state, and media playback in the release build. Credential setup is evolving in parallel: update only after the parent verifies the working path. Do not promise all remote links are offline files.

**Rewrite review:** [rewrite-review-01-08.md](rewrite-review-01-08.md).

<a id="09"></a>
## 09 · Find a Bible passage from the words you remember

[Read draft](articles/09-find-scripture-from-a-phrase.md) · Tutorial · Implementation

**Legacy proposed date:** 2026-04-29 — a requested planning date, not publication history.

**Question:** How can I search by a phrase, person, event, or recent speech?

**Implemented task coverage:** `scripture.phrase-topic-search`, `scripture.recent-speech-search`, `bible.lookup-preview-reference`, `bible.change-session-version`.

**Evidence:** ScriptureStorySearch corrects typos and offers use original; ScriptureFindOverlay card selection pushesReference. ScripturesBrowser reference submit sends live. find-heard-scripture limits recent words, supplies meaning availability, and reads actual passage text.

Sources: [src/design/screens/ScriptureCatches.tsx](../../src/design/screens/ScriptureCatches.tsx), [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx), [electron/main.ts](../../electron/main.ts), [electron/engine/heardWindow.ts](../../electron/engine/heardWindow.ts).

**Visuals:**

1. Verses with the two search fields clearly identified using their current labels. Proposed alt text: “Separate reference and phrase search fields in Trilorah.”
2. A verified sample result for a story query with supporting text and a caption saying result selection sends live. Proposed alt text: “Candidate Bible passages for a remembered story, ready for operator review.”

**Before publication:** Run each example in the intended translation; avoid implying a guaranteed top match. Verify typo reversal and unavailable meaning behavior. Recent speech is limited; no whole-sermon search claim.

**Rewrite review:** [rewrite-review-09-16.md](rewrite-review-09-16.md).

<a id="10"></a>
## 10 · Make an announcement slide or import a presentation

[Read draft](articles/10-create-announcements-and-import-slides.md) · Tutorial · Implementation

**Legacy proposed date:** 2026-05-12 — a requested planning date, not publication history.

**Question:** When should I use Quick slide, and how do I import an existing deck?

**Implemented task coverage:** `slides.create-quick-slide`, `slides.import-deck`, `output.publish-preview`, `run.queue-content-note`.

**Evidence:** QuickSlideModal supports title/subtitle/points. Presentation import converts PPTX/PPT/ODP through LibreOffice and Poppler to static slide images; imported decks are not a native editable presentation. Missing conversion dependencies produce explicit errors.

Sources: [src/design/screens/presentations.tsx](../../src/design/screens/presentations.tsx), [electron/media/pptxConverter.ts](../../electron/media/pptxConverter.ts), [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx), [electron/main.ts](../../electron/main.ts).

**Visuals:**

1. Quick slide with the original Community lunch example and create slide visible. Proposed alt text: “Creating a community lunch announcement with title, subtitle, and body.”
2. A small original imported deck showing multiple rendered page thumbnails. Proposed alt text: “Rendered pages from an imported presentation in the Slides library.”

**Before publication:** Create/save/reopen a quick slide and convert a test presentation. Inspect every rendered page. No promise that original animation/interactivity survives conversion; content edits belong in the source deck.

**Rewrite review:** [rewrite-review-09-16.md](rewrite-review-09-16.md).

<a id="11"></a>
## 11 · Save your service. Open it on the church computer.

[Read draft](articles/11-save-and-transfer-a-service.md) · Tutorial · Implementation

**Legacy proposed date:** 2026-05-26 — a requested planning date, not publication history.

**Question:** What should I save, and what is the difference between opening and importing a .tri file?

**Implemented task coverage:** `files.save-open-transfer`, `run.build-edit`, `media.import-preview-local`.

**Evidence:** TriPackageActions savePackage, prepareSave, inspect, and autosave effect implement selection, initial save, warnings, export and replacement consent. triClient applies selected resources and renderer state.

Sources: [src/design/screens/run/TriPackageActions.tsx](../../src/design/screens/run/TriPackageActions.tsx), [src/lib/triClient.ts](../../src/lib/triClient.ts), [shared/triPackage.ts](../../shared/triPackage.ts), [shared/triBridge.ts](../../shared/triBridge.ts).

**Visuals:**

1. The .tri resource-selection view with synthetic service contents and no personal path. Proposed alt text: “Choosing which service resources to save in a Trilorah package.”
2. Small original diagram: continue a service → Open; add selected resources → Import. Show replacement confirmation separately if a screenshot is clearer. Proposed alt text: “Open continues the packaged service; import adds selected material to existing work.”

**Before publication:** Perform an actual save/open/import and, before publishing cross-computer claims, transfer to another machine or clean profile. Check local assets and warnings. Do not equate remote URLs with offline packaging or settings with connected hardware.

**Rewrite review:** [rewrite-review-09-16.md](rewrite-review-09-16.md).

<a id="12"></a>
## 12 · Make your slides readable from the back row

[Read draft](articles/12-make-projected-words-readable.md) · Tutorial · Implementation

**Legacy proposed date:** 2026-06-09 — a requested planning date, not publication history.

**Question:** Which Trilorah controls help projected words remain clear in the actual room?

**Implemented task coverage:** `themes.adjust-text-layout`, `themes.change-background`, `songs.create-edit-slides`, `output.publish-preview`.

**Evidence:** ThemesEditor exposes font/sizes/shadow/dimness/blur/position/margins/width. Most layout changes stage in preview; transition handlers differ. Background interactions distinguish preview/live. SongEditor splits dense lyric sections.

Sources: [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx), [src/lib/backgroundDrop.ts](../../src/lib/backgroundDrop.ts), [src/design/screens/songs/SongEditor.tsx](../../src/design/screens/songs/SongEditor.tsx).

**Visuals:**

1. Before/after of identical original text and background with only the described readability adjustments changed; keep viewport and crop identical. Proposed alt text: “The same text before and after increased separation from its background.”
2. Optional actual room photo from a rear seat showing the final slide. A laptop screenshot alone must not be captioned as proof of room readability. Proposed alt text: “A readable rehearsal slide viewed from the back of the room.”

**Before publication:** Check the longest sample content on the real display and show the exact settings used. Avoid universal font-size claims or a simulated room image presented as a real check.

**Rewrite review:** [rewrite-review-09-16.md](rewrite-review-09-16.md).

<a id="13"></a>
## 13 · No scripture appearing? Check sound, words, then recognition.

[Read draft](articles/13-when-trilorah-cannot-hear-you.md) · Troubleshooting · Implementation

**Legacy proposed date:** 2026-06-23 — a requested planning date, not publication history.

**Question:** Is the problem the audio input, transcription, or scripture recognition?

**Implemented task coverage:** `audio.troubleshoot`, `audio.choose-input`, `audio.start-stop-listening`, `scripture.catch-and-project`, `notifications.resolve`.

**Evidence:** Capture paths emit input/permission failures; selected device can differ from connected phone. Notices route to controls. Practice sermon emits recognizer text and does not test actual microphone/ASR capture.

Sources: [src/lib/micCapture.ts](../../src/lib/micCapture.ts), [src/components/MicPicker.tsx](../../src/components/MicPicker.tsx), [src/components/PhoneMicPanel.tsx](../../src/components/PhoneMicPanel.tsx), [src/components/NotificationCenter.tsx](../../src/components/NotificationCenter.tsx), [electron/asr/practiceSermon.ts](../../electron/asr/practiceSermon.ts).

**Visuals:**

1. Original three-stage diagram: level? → new words? → reference candidate?; each no branch points to the corresponding article section. Proposed alt text: “Troubleshooting flow separating audio, transcription, and scripture recognition.”
2. A real, reproducible input or engine error in a test profile with a caption naming the condition. No invented alert screenshot. Proposed alt text: “An audio problem notice with a route to the relevant controls.”

**Before publication:** Exercise at least no-input and speech-engine-not-ready conditions. Verify displayed notice labels and fresh-word checks. Keep practice sermon distinct from the isolated guide demo.

**Rewrite review:** [rewrite-review-09-16.md](rewrite-review-09-16.md).

<a id="14"></a>
## 14 · Train a new volunteer by running a small service

[Read draft](articles/14-train-a-new-volunteer.md) · Training playbook · Implementation / retention

**Legacy proposed date:** 2026-07-07 — a requested planning date, not publication history.

**Question:** What should a new operator learn first, and how can we tell they are ready?

**Implemented task coverage:** `navigation.open-library`, `run.build-edit`, `output.publish-preview`, `output.clear-restore`, `scripture.catch-and-project`, `files.save-open-transfer`.

**Evidence:** The operator surface supplies the practiced tasks. ProductGuide and registered walkthroughs supply Show me / I’ll do it and bounded cursor guidance. Guide workflow coverage is changing in this implementation task.

Sources: [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx), [src/components/ProductGuide.tsx](../../src/components/ProductGuide.tsx), [src/lib/guideWalkthroughs.ts](../../src/lib/guideWalkthroughs.ts), [src/components/useGuideCursor.ts](../../src/components/useGuideCursor.ts).

**Visuals:**

1. The same synthetic four-item run used in article 02, now with one clear trainer cue in a note. Proposed alt text: “A short practice service for a new presentation volunteer.”
2. Released guide preview showing its actual Show me / I’ll do it choice and cursor bubble. Optional captioned 20-second walkthrough after runtime verification. Proposed alt text: “The Trilorah guide offering to demonstrate a step or let the volunteer try it.”

**Before publication:** Have a volunteer try the rehearsal or clearly present it as an untested suggested training format. Parent must confirm final guide controls/coverage before capturing. No claim that the guide knows every possible instruction or verifies all hardware.

**Rewrite review:** [rewrite-review-09-16.md](rewrite-review-09-16.md).

<a id="15"></a>
## 15 · Help Trilorah recognise your preacher’s references

[Read draft](articles/15-preacher-sound-check-and-review.md) · Tutorial · Implementation / retention

**Legacy proposed date:** 2026-07-17 — a requested planning date, not publication history.

**Question:** How do sound checks, corrections, and teaching help without promising perfect recognition?

**Implemented task coverage:** `preacher.create-select`, `preacher.sound-check`, `preacher.review-recognition`, `preacher.teach-vocabulary`.

**Evidence:** Sound check uses local speech. Review and teaching are profile-specific. Visible sections are sounds like, their words, and ignored after a verse. Verified review affects readiness; it does not automatically publish scripture catches. Voice commands are separate controls.

Sources: [src/design/screens/dashboard/ProfileView.tsx](../../src/design/screens/dashboard/ProfileView.tsx), [src/design/screens/dashboard/LearningActions.tsx](../../src/design/screens/dashboard/LearningActions.tsx), [src/design/screens/dashboard/Teaching.tsx](../../src/design/screens/dashboard/Teaching.tsx), [electron/main.ts](../../electron/main.ts), [electron/engine/verseDelivery.ts](../../electron/engine/verseDelivery.ts).

**Visuals:**

1. Sound check & review with an original rehearsal profile and available exercise controls. Proposed alt text: “Preacher sound-check exercises in Trilorah.”
2. Synthetic misheard reference review with Correct, Wrong reference, Not a reference, and uncertain choices. Never screenshot private sermon material. Proposed alt text: “Review choices for a recognition example before confirming or correcting it.”

**Before publication:** Test sound-check model setup and one saved correction. Confirm local test/provider distinction. Do not claim acoustic voice cloning, perfect learning, or automatic projection when a score rises. Use current teaching labels: sounds like, their words, ignored after a verse; distinguish configured voice commands from scripture catches.

**Rewrite review:** [rewrite-review-09-16.md](rewrite-review-09-16.md).

<a id="16"></a>
## 16 · Turn the programme in your group chat into a service plan

[Read draft](articles/16-turn-a-programme-into-a-service.md) · Workflow / reusable example · Implementation

**Legacy proposed date:** 2026-07-28 — a requested planning date, not publication history.

**Question:** How do I scan or paste a programme, review it, and finish the service preparation?

**Implemented task coverage:** `run.import-programme`, `run.build-edit`, `run.queue-content-note`, `files.save-open-transfer`.

**Evidence:** Paste/Scan controls are in the run footer; read it creates editable review rows; add to run appends visible segments and replaces the separate schedule. The exact text example passed parseOrderOfService. Photo OCR remains unverified.

Sources: [src/design/screens/run/RunHeaderActions.tsx](../../src/design/screens/run/RunHeaderActions.tsx), [src/design/screens/run/ScanReview.tsx](../../src/design/screens/run/ScanReview.tsx), [shared/runOfServiceParse.ts](../../shared/runOfServiceParse.ts), [src/design/screens/run.tsx](../../src/design/screens/run.tsx).

**Visuals:**

1. Create an original four-line programme from the article, then capture the actual paste/scan review. Proposed alt text: “Reviewing proposed service segments from a sample programme.”
2. The resulting run with valid content and one operator note added. Optional three-frame programme → review → prepared run sequence. Proposed alt text: “A reviewed service run with its content prepared for rehearsal.”

**Before publication:** Parse the exact article sample and scan an original programme image. Check duplicate import and schedule replacement behavior. Use additive run vs replaced schedule wording until implementation changes. Capture current Paste/Scan footer controls. The text parser example passed on October 11; this does not verify photo OCR.

**Rewrite review:** [rewrite-review-09-16.md](rewrite-review-09-16.md).

## Additional stories

The six feature introductions have their own [release evidence](future-features/evidence.md) and [visual plan](future-features/README.md#components-and-visuals). The founder story has a [source and visual note](stories/editorial-notes.md).
