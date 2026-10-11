# Editorial notes: visuals, evidence, and remaining checks

All article claims were checked against the current working-tree implementation, using the product map as an index. This is source review, not complete runtime certification. Code may change while the guide is being expanded; use the release check on each entry before publication. No assets listed here have been captured by this content task.

Use real UI for product screenshots; original sample content for lyric, transcript, slide, and programme examples. Never expose secrets, pairing codes, personal paths, or private sermon content. Optional clips should have captions and a text equivalent in the article.

<a id="01"></a>
## 01 · Meet Trilorah: prepare the service, follow the sermon

[Read draft](articles/01-meet-trilorah.md) · Proposed 2026-03-02 · Introduction · Awareness

**Question:** What does Trilorah do, and where should our team begin?

**Implemented task coverage:** `navigation.open-library`, `run.build-edit`, `scripture.catch-and-project`, `output.publish-preview`.

**Evidence:** LiveBody and LibraryTabs establish the current workspace. RunRail supplies the service structure. VerseDelivery.promote accepts explicit operator/remote sources only.

Sources: [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx), [src/design/screens/run/RunRail.tsx](../../src/design/screens/run/RunRail.tsx), [electron/engine/verseDelivery.ts](../../electron/engine/verseDelivery.ts).

**Visuals:**

1. Operator workspace with a short synthetic run, library tabs, preview, and live all visible. Add four small labels; keep their UI names unchanged. Proposed alt text: “Trilorah operator workspace showing a service run, content libraries, preview, and live output.”
2. Optional 20–35 second captioned clip of one real spoken reference appearing as a candidate, followed by a deliberate operator send. Label the recording as a demonstration. Proposed alt text: “A spoken reference becomes a suggestion before the operator sends it live.”

**Before publication:** Walk the four-item sample service in the release desktop build. Confirm the current tab labels and explicit publication behavior. Do not use the website example assistant as proof of desktop capability.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

<a id="02"></a>
## 02 · Your first service in Trilorah: a rehearsal checklist

[Read draft](articles/02-first-service-checklist.md) · Proposed 2026-03-05 · Checklist · Implementation

**Question:** What should I check before using Trilorah in a service?

**Implemented task coverage:** `outputs.assign`, `run.build-edit`, `output.publish-preview`, `output.clear-restore`, `audio.choose-input`, `files.save-open-transfer`.

**Evidence:** OutputsTile maps roles/displays; MicPicker selects audio; Stage/ScripturesBrowser distinguish preview and direct-send actions; TriPackageActions requires an initial file save for autosave.

Sources: [src/design/screens/dashboard/OutputsTile.tsx](../../src/design/screens/dashboard/OutputsTile.tsx), [src/components/MicPicker.tsx](../../src/components/MicPicker.tsx), [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx), [src/design/screens/run/TriPackageActions.tsx](../../src/design/screens/run/TriPackageActions.tsx).

**Visuals:**

1. Dashboard Outputs with a real connected rehearsal display and its job/display controls. Use a generic device label where possible. Proposed alt text: “Output job and display choices in Trilorah.”
2. Operator workspace during a prepared four-item practice service. Use the article checklist beside the image rather than a screenshot of a checklist. Proposed alt text: “A practice service containing a welcome, song, scripture, and closing slide.”

**Before publication:** Rehearse on actual hardware. Verify clear/restore and initial save. The practice sermon is not an isolated output sandbox; all sample live actions belong in rehearsal.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

<a id="03"></a>
## 03 · Connect a microphone to Trilorah and check that it hears you

[Read draft](articles/03-connect-a-microphone.md) · Proposed 2026-03-09 · Tutorial · Implementation

**Question:** How do I select the right microphone and confirm that transcription works?

**Implemented task coverage:** `audio.choose-input`, `audio.start-stop-listening`, `audio.troubleshoot`, `audio.phone-microphone`.

**Evidence:** MicPicker.choose persists input and can restart listening. openMicrophone handles permissions/devices. PhoneMicPanel connects separately from use phone audio. The engine listen path updates UI before all backend work completes.

Sources: [src/components/MicPicker.tsx](../../src/components/MicPicker.tsx), [src/lib/micCapture.ts](../../src/lib/micCapture.ts), [src/components/PhoneMicPanel.tsx](../../src/components/PhoneMicPanel.tsx), [src/design/screens/engine.tsx](../../src/design/screens/engine.tsx).

**Visuals:**

1. Open Audio beneath preview with the intended device selected; mask personal device names if necessary. Proposed alt text: “The Audio menu with a microphone selected.”
2. A single cropped view containing the responding audio level and fresh sample transcript from the same sentence. Optionally record this check with captions. Proposed alt text: “Audio activity and new transcript words during a microphone check.”

**Before publication:** Run a real input and transcription test; if showing phone steps, pair a test phone and verify use phone audio separately. Exclude live pairing codes from the published image. No engine-key provisioning tutorial is asserted.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

<a id="04"></a>
## 04 · How Trilorah recognizes scripture during a sermon

[Read draft](articles/04-how-scripture-recognition-works.md) · Proposed 2026-03-13 · Feature explanation · Consideration / implementation

**Question:** How do spoken references and quotations become scripture suggestions, and who controls projection?

**Implemented task coverage:** `scripture.catch-and-project`, `scripture.recent-speech-search`, `scripture.phrase-topic-search`, `preacher.review-recognition`.

**Evidence:** main.ts stages detections with manualOnly and rejects auto-mode-set enabled. VerseDelivery.promote blocks automatic sources. QuoteMatcher.loadIndex reports KJV/BSB wordings. ScriptureCatches exposes recent and typed search with live result selection.

Sources: [electron/main.ts](../../electron/main.ts), [electron/engine/verseDelivery.ts](../../electron/engine/verseDelivery.ts), [electron/engine/quoteMatcher.ts](../../electron/engine/quoteMatcher.ts), [src/design/screens/ScriptureCatches.tsx](../../src/design/screens/ScriptureCatches.tsx).

**Visuals:**

1. A real captured reference with the transcript clue and candidate reference visible. Caption the example and tested Bible translation. Proposed alt text: “A spoken Bible reference and its suggested passage in Trilorah.”
2. Two frames from the same test: candidate in preview, then the chosen verse live after the operator press. A short captioned clip is preferable if available. Proposed alt text: “The operator checks the candidate before sending the verse live.”

**Before publication:** Record explicit-reference and quotation examples on the release build. If a quotation example does not match, show the failure/fallback or choose a verified example; do not fake the UI. Reconfirm auto-mode prohibition before publishing.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

<a id="05"></a>
## 05 · Put the right content on the right screen in Trilorah

[Read draft](articles/05-connect-the-right-screens.md) · Proposed 2026-03-20 · Tutorial · Implementation

**Question:** How do I assign an output to a connected display and verify it?

**Implemented task coverage:** `outputs.assign`, `outputs.preferences`, `output.publish-preview`, `output.clear-restore`.

**Evidence:** OutputsTile.rowsFor provides job/display handlers; fromEngine.saveRole/saveDisplay persists choices. ROLE_SHOWS describes projector/stream/stage/timer. Settings exposes layout preferences rather than the effective display assignment workflow.

Sources: [src/design/screens/dashboard/OutputsTile.tsx](../../src/design/screens/dashboard/OutputsTile.tsx), [src/design/screens/dashboard/outputs/fromEngine.ts](../../src/design/screens/dashboard/outputs/fromEngine.ts), [src/design/screens/dashboard/outputs/types.ts](../../src/design/screens/dashboard/outputs/types.ts), [src/design/screens/Settings.tsx](../../src/design/screens/Settings.tsx).

**Visuals:**

1. Expanded Dashboard Outputs showing actual connected hardware, job selector, display selector, and status. Proposed alt text: “A projector output assigned to a connected display.”
2. Photo of a real rehearsal screen showing an original Projector check slide; exclude people unless appropriately arranged. Proposed alt text: “The test slide on the physical display used for the service.”

**Before publication:** Test screen assignments and no-screen/off on real hardware. Never substitute design.html sample screens. A stream role does not prove an external broadcast is configured.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

<a id="06"></a>
## 06 · Build an order of service your next volunteer can follow

[Read draft](articles/06-build-an-order-of-service.md) · Proposed 2026-03-27 · Tutorial · Implementation

**Question:** How do I organize segments, content, and notes for a service?

**Implemented task coverage:** `run.build-edit`, `run.queue-content-note`, `files.save-open-transfer`.

**Evidence:** RunHeaderActions onArrange adds segments and loadDefault replaces the run. RunRail/useRun provide segment edits and notes. Library drag payloads carry content; a queued song label alone is insufficient for live text.

Sources: [src/design/screens/run/RunHeaderActions.tsx](../../src/design/screens/run/RunHeaderActions.tsx), [src/design/screens/run/RunRail.tsx](../../src/design/screens/run/RunRail.tsx), [src/design/screens/run.tsx](../../src/design/screens/run.tsx), [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx).

**Visuals:**

1. The run plus menu with add segment expanded and a small example order. Proposed alt text: “Adding and arranging segments in a service run.”
2. A segment containing valid queued material and an operator note, with no real congregation data. Proposed alt text: “A service segment with prepared content and a timing note.”

**Before publication:** Create/edit/reorder a small run; test a library drag and segment note. Do not demonstrate the unwired header media/note tiles as a working route. Confirm saved content after reopening.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

<a id="07"></a>
## 07 · Prepare song lyrics that are easy to follow on Sunday

[Read draft](articles/07-prepare-song-lyrics.md) · Proposed 2026-04-07 · Tutorial · Implementation

**Question:** How do I add a song, organize its sections, and preview the words?

**Implemented task coverage:** `songs.create-edit-slides`, `songs.find-local`, `songs.preview-display-section`, `songs.discover-online`.

**Evidence:** SongEditor organizes sections and saves. SongLyricsEntry provides input. AddSongDialog opens online material into an editor. SongSheet separates Preview section and go live.

Sources: [src/design/screens/songs/SongEditor.tsx](../../src/design/screens/songs/SongEditor.tsx), [src/design/screens/songs/SongLyricsEntry.tsx](../../src/design/screens/songs/SongLyricsEntry.tsx), [src/design/screens/songs/AddSongDialog.tsx](../../src/design/screens/songs/AddSongDialog.tsx), [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx).

**Visuals:**

1. Song editor with original short training lyrics showing a useful split boundary and save control. Proposed alt text: “A song editor with lyric sections and a save control.”
2. The saved song section cards showing preview and go live as different actions. Optional split/reorder clip. Proposed alt text: “Saved lyric cards with separate preview and live controls.”

**Before publication:** Create/save/reopen a song, split a long section, and test preview then send during rehearsal. Online results require review and save. Do not use a copyrighted full lyric as sample documentation.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

<a id="08"></a>
## 08 · Add images and videos to Trilorah without confusing media and backgrounds

[Read draft](articles/08-use-images-and-videos.md) · Proposed 2026-04-17 · Tutorial · Implementation

**Question:** How do I import media, find online visuals, and decide how they should appear?

**Implemented task coverage:** `media.import-preview-local`, `media.find-online`, `themes.change-background`, `output.publish-preview`.

**Evidence:** MediaBrowser.addHere imports and stages media. StockSearch.pick awaits download before onPick. Theme clicks stage backgrounds; double-click/live drops change live backgrounds. Online tab stages standalone media.

Sources: [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx), [src/design/screens/stockSearch.tsx](../../src/design/screens/stockSearch.tsx), [src/design/screens/mediaLibrary.ts](../../src/design/screens/mediaLibrary.ts), [src/lib/backgroundDrop.ts](../../src/lib/backgroundDrop.ts).

**Visuals:**

1. Media library with one original local example and its standalone preview. Proposed alt text: “An imported picture selected as standalone media in preview.”
2. The same visual behind original text using the themes shelf; label preview and live only where they actually appear. Optional 10–15 second preview drop clip. Proposed alt text: “An image used as a background behind words in preview.”

**Before publication:** Test local import, download, provider failure state, and media playback in the release build. Credential setup is evolving in parallel: update only after the parent verifies the working path. Do not promise all remote links are offline files.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

<a id="09"></a>
## 09 · Find a Bible passage when you remember the words, not the reference

[Read draft](articles/09-find-scripture-from-a-phrase.md) · Proposed 2026-04-29 · Tutorial · Implementation

**Question:** How can I search by a phrase, person, event, or recent speech?

**Implemented task coverage:** `scripture.phrase-topic-search`, `scripture.recent-speech-search`, `bible.lookup-preview-reference`, `bible.change-session-version`.

**Evidence:** ScriptureStorySearch corrects typos and offers use original; ScriptureFindOverlay card selection pushesReference. ScripturesBrowser reference submit sends live. find-heard-scripture limits recent words, supplies meaning availability, and reads actual passage text.

Sources: [src/design/screens/ScriptureCatches.tsx](../../src/design/screens/ScriptureCatches.tsx), [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx), [electron/main.ts](../../electron/main.ts), [electron/engine/heardWindow.ts](../../electron/engine/heardWindow.ts).

**Visuals:**

1. Verses with the two search fields clearly identified using their current labels. Proposed alt text: “Separate reference and phrase search fields in Trilorah.”
2. A verified sample result for a story query with supporting text and a caption saying result selection sends live. Proposed alt text: “Candidate Bible passages for a remembered story, ready for operator review.”

**Before publication:** Run each example in the intended translation; avoid implying a guaranteed top match. Verify typo reversal and unavailable meaning behavior. Recent speech is limited; no whole-sermon search claim.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

<a id="10"></a>
## 10 · Create an announcement slide or bring in a prepared presentation

[Read draft](articles/10-create-announcements-and-import-slides.md) · Proposed 2026-05-12 · Tutorial · Implementation

**Question:** When should I use Quick slide, and how do I import an existing deck?

**Implemented task coverage:** `slides.create-quick-slide`, `slides.import-deck`, `output.publish-preview`, `run.queue-content-note`.

**Evidence:** QuickSlideDialog creates title/subtitle/body content; imports render presentation pages; nameOnly editing prevents arbitrary imported-slide changes; Live supplies stage/send interactions.

Sources: [src/design/screens/presentations.tsx](../../src/design/screens/presentations.tsx), [electron/media/pptxConverter.ts](../../electron/media/pptxConverter.ts), [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx).

**Visuals:**

1. Quick slide with the original Community lunch example and create slide visible. Proposed alt text: “Creating a community lunch announcement with title, subtitle, and body.”
2. A small original imported deck showing multiple rendered page thumbnails. Proposed alt text: “Rendered pages from an imported presentation in the Slides library.”

**Before publication:** Create/save/reopen a quick slide and convert a test presentation. Inspect every rendered page. No promise that original animation/interactivity survives conversion; content edits belong in the source deck.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

<a id="11"></a>
## 11 · Save a Trilorah service and move it to another computer

[Read draft](articles/11-save-and-transfer-a-service.md) · Proposed 2026-05-26 · Tutorial · Implementation

**Question:** What should I save, and what is the difference between opening and importing a .tri file?

**Implemented task coverage:** `files.save-open-transfer`, `run.build-edit`, `media.import-preview-local`.

**Evidence:** TriPackageActions savePackage, prepareSave, inspect, and autosave effect implement selection, initial save, warnings, export and replacement consent. triClient applies selected resources and renderer state.

Sources: [src/design/screens/run/TriPackageActions.tsx](../../src/design/screens/run/TriPackageActions.tsx), [src/lib/triClient.ts](../../src/lib/triClient.ts), [shared/triPackage.ts](../../shared/triPackage.ts), [shared/triBridge.ts](../../shared/triBridge.ts).

**Visuals:**

1. The .tri resource-selection view with synthetic service contents and no personal path. Proposed alt text: “Choosing which service resources to save in a Trilorah package.”
2. Small original diagram: continue a service → Open; add selected resources → Import. Show replacement confirmation separately if a screenshot is clearer. Proposed alt text: “Open continues the packaged service; import adds selected material to existing work.”

**Before publication:** Perform an actual save/open/import and, before publishing cross-computer claims, transfer to another machine or clean profile. Check local assets and warnings. Do not equate remote URLs with offline packaging or settings with connected hardware.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

<a id="12"></a>
## 12 · Make scripture and lyrics readable from the back of the room

[Read draft](articles/12-make-projected-words-readable.md) · Proposed 2026-06-09 · Tutorial · Implementation

**Question:** Which Trilorah controls help projected words remain clear in the actual room?

**Implemented task coverage:** `themes.adjust-text-layout`, `themes.change-background`, `songs.create-edit-slides`, `output.publish-preview`.

**Evidence:** ThemesEditor exposes font/sizes/shadow/dimness/blur/position/margins/width. Most layout changes stage in preview; transition handlers differ. Background interactions distinguish preview/live. SongEditor splits dense lyric sections.

Sources: [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx), [src/lib/backgroundDrop.ts](../../src/lib/backgroundDrop.ts), [src/design/screens/songs/SongEditor.tsx](../../src/design/screens/songs/SongEditor.tsx).

**Visuals:**

1. Before/after of identical original text and background with only the described readability adjustments changed; keep viewport and crop identical. Proposed alt text: “The same text before and after increased separation from its background.”
2. Optional actual room photo from a rear seat showing the final slide. A laptop screenshot alone must not be captioned as proof of room readability. Proposed alt text: “A readable rehearsal slide viewed from the back of the room.”

**Before publication:** Check the longest sample content on the real display and show the exact settings used. Avoid universal font-size claims or a simulated room image presented as a real check.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

<a id="13"></a>
## 13 · Trilorah cannot hear the preacher: check the problem in three stages

[Read draft](articles/13-when-trilorah-cannot-hear-you.md) · Proposed 2026-06-23 · Troubleshooting · Implementation

**Question:** Is the problem the audio input, transcription, or scripture recognition?

**Implemented task coverage:** `audio.troubleshoot`, `audio.choose-input`, `audio.start-stop-listening`, `scripture.catch-and-project`, `notifications.resolve`.

**Evidence:** Capture paths emit input/permission failures; selected device can differ from connected phone. Notices route to controls. Practice sermon emits recognizer text and does not test actual microphone/ASR capture.

Sources: [src/lib/micCapture.ts](../../src/lib/micCapture.ts), [src/components/MicPicker.tsx](../../src/components/MicPicker.tsx), [src/components/PhoneMicPanel.tsx](../../src/components/PhoneMicPanel.tsx), [src/components/NotificationCenter.tsx](../../src/components/NotificationCenter.tsx), [electron/asr/practiceSermon.ts](../../electron/asr/practiceSermon.ts).

**Visuals:**

1. Original three-stage diagram: level? → new words? → reference candidate?; each no branch points to the corresponding article section. Proposed alt text: “Troubleshooting flow separating audio, transcription, and scripture recognition.”
2. A real, reproducible input or engine error in a test profile with a caption naming the condition. No invented alert screenshot. Proposed alt text: “An audio problem notice with a route to the relevant controls.”

**Before publication:** Exercise at least no-input and speech-engine-not-ready conditions. Verify displayed notice labels and fresh-word checks. Keep practice sermon distinct from the isolated guide demo.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

<a id="14"></a>
## 14 · Teach a new Trilorah volunteer one complete service

[Read draft](articles/14-train-a-new-volunteer.md) · Proposed 2026-07-07 · Training playbook · Implementation / retention

**Question:** What should a new operator learn first, and how can we tell they are ready?

**Implemented task coverage:** `navigation.open-library`, `run.build-edit`, `output.publish-preview`, `output.clear-restore`, `scripture.catch-and-project`, `files.save-open-transfer`.

**Evidence:** The operator surface supplies the practiced tasks. ProductGuide and registered walkthroughs supply Show me / I’ll do it and bounded cursor guidance. Guide workflow coverage is changing in this implementation task.

Sources: [src/design/screens/Live.tsx](../../src/design/screens/Live.tsx), [src/components/ProductGuide.tsx](../../src/components/ProductGuide.tsx), [src/lib/guideWalkthroughs.ts](../../src/lib/guideWalkthroughs.ts), [src/components/useGuideCursor.ts](../../src/components/useGuideCursor.ts).

**Visuals:**

1. The same synthetic four-item run used in article 02, now with one clear trainer cue in a note. Proposed alt text: “A short practice service for a new presentation volunteer.”
2. Released guide preview showing its actual Show me / I’ll do it choice and cursor bubble. Optional captioned 20-second walkthrough after runtime verification. Proposed alt text: “The Trilorah guide offering to demonstrate a step or let the volunteer try it.”

**Before publication:** Have a volunteer try the rehearsal or clearly present it as an untested suggested training format. Parent must confirm final guide controls/coverage before capturing. No claim that the guide knows every possible instruction or verifies all hardware.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

<a id="15"></a>
## 15 · Use a preacher sound check and review missed scripture

[Read draft](articles/15-preacher-sound-check-and-review.md) · Proposed 2026-07-17 · Tutorial · Implementation / retention

**Question:** How do sound checks, corrections, and teaching help without promising perfect recognition?

**Implemented task coverage:** `preacher.create-select`, `preacher.sound-check`, `preacher.review-recognition`, `preacher.teach-vocabulary`.

**Evidence:** ProfileView selects today’s preacher. LearningActions provides local sound checks, verified review answers, corrections and missed examples. Teaching separates alias/vocabulary/ignored-tail stages. main rejects automatic projection regardless of readiness.

Sources: [src/design/screens/dashboard/ProfileView.tsx](../../src/design/screens/dashboard/ProfileView.tsx), [src/design/screens/dashboard/LearningActions.tsx](../../src/design/screens/dashboard/LearningActions.tsx), [src/design/screens/dashboard/Teaching.tsx](../../src/design/screens/dashboard/Teaching.tsx), [electron/main.ts](../../electron/main.ts).

**Visuals:**

1. Sound check & review with an original rehearsal profile and available exercise controls. Proposed alt text: “Preacher sound-check exercises in Trilorah.”
2. Synthetic misheard reference review with Correct, Wrong reference, Not a reference, and uncertain choices. Never screenshot private sermon material. Proposed alt text: “Review choices for a recognition example before confirming or correcting it.”

**Before publication:** Test sound-check model setup and one saved correction. Confirm local test/provider distinction. Do not claim acoustic voice cloning, perfect learning, or automatic projection when a score rises.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

<a id="16"></a>
## 16 · Turn a service programme into a run you can rehearse

[Read draft](articles/16-turn-a-programme-into-a-service.md) · Proposed 2026-07-28 · Workflow / reusable example · Implementation

**Question:** How do I scan or paste a programme, review it, and finish the service preparation?

**Implemented task coverage:** `run.import-programme`, `run.build-edit`, `run.queue-content-note`, `files.save-open-transfer`.

**Evidence:** RunHeaderActions.scan returns rows to review and falls back to text with explanatory errors. onAdd appends run.addSegments but replaces the engine schedule through setServiceSchedule. ScanReview edits proposed rows before adding.

Sources: [src/design/screens/run/RunHeaderActions.tsx](../../src/design/screens/run/RunHeaderActions.tsx), [src/design/screens/run/ScanReview.tsx](../../src/design/screens/run/ScanReview.tsx), [shared/runOfServiceParse.ts](../../shared/runOfServiceParse.ts), [src/design/screens/run.tsx](../../src/design/screens/run.tsx).

**Visuals:**

1. Create an original four-line programme from the article, then capture the actual paste/scan review. Proposed alt text: “Reviewing proposed service segments from a sample programme.”
2. The resulting run with valid content and one operator note added. Optional three-frame programme → review → prepared run sequence. Proposed alt text: “A reviewed service run with its content prepared for rehearsal.”

**Before publication:** Parse the exact article sample and scan an original programme image. Check duplicate import and schedule replacement behavior. Use additive run vs replaced schedule wording until implementation changes.

**Current readiness:** full copy draft; source evidence located; screenshot/clip production and the stated runtime checks remain.

