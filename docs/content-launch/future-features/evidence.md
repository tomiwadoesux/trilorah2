# Future feature stories: claim evidence

Reviewed and critical claims rechecked October 11, 2026 against the current working tree, including existing uncommitted work. This is source inspection, not a new end-to-end test report. Stable function names and command cases are listed so future edits can be rechecked even when line numbers move. Paths are relative to this folder.

## 1. Mobile remote controls

**Implemented path:** the desktop opens mobile access; the phone loads a local web page, requests pairing, and receives a token after desktop approval. The page calls commands that the desktop applies.

| Claim | Source and implementation anchor |
| --- | --- |
| Same-network connection; QR and pairing code; desktop approve/decline; revocable paired devices. | [MobileRemotePanel.tsx](../../../src/components/MobileRemotePanel.tsx): `MobileRemoteIntro`, `MobileRemotePanel`, `act`, paired-device actions. |
| Requests wait for desktop approval; commands require a verified token. | [mobileServer.ts](../../../electron/integrations/mobileServer.ts): `MobileServer.handle`, `/api/pair`, `/api/pair-status`, `/api/command`. |
| The remote displays live/preview state, caught scripture, saved song cards, decks, media, and run items. | [mobile-remote.html](../../../public/mobile-remote.html): `renderMonitor`, `renderReady`, `renderProposals`, `drawSongCards`, `renderDecks`; [useMobileRemote.ts](../../../src/design/screens/useMobileRemote.ts): `execute`, `state`, `library`, `proposal`, `song`, `deck`, `media`, `run` cases. |
| Go live rejects a preview ID that changed on the desktop. | [useMobileRemote.ts](../../../src/design/screens/useMobileRemote.ts): `execute` → `live` compares `a.id` with current `p.preview.id` before `p.promote()`. |
| Some explicit phone buttons publish directly. Do not claim every selection always stops at preview. | [mobile-remote.html](../../../public/mobile-remote.html): scripture Send action and song-card `live` button; [useMobileRemote.ts](../../../src/design/screens/useMobileRemote.ts): `verse` and `song` send when `a.live === true`. |
| The phone can step through scripture/lyric/deck content and change screen state or video playback. | [useMobileRemote.ts](../../../src/design/screens/useMobileRemote.ts): `step`, `screen`, `playback` cases. Verify each advertised combination, including long scripture slides. |
| A phone can edit an existing saved lyric card. | [mobile-remote.html](../../../public/mobile-remote.html): `editCard`; [useMobileRemote.ts](../../../src/design/screens/useMobileRemote.ts): `song-edit` validates and saves through `songs.update`. This is a library mutation, not temporary live-only text. |
| The desktop must respond; stale commands are not intentionally queued for replay. | [mobileBridge.ts](../../../electron/integrations/mobileBridge.ts): `MobileBridge.request` deadline/time-out; [useMobileRemote.ts](../../../src/design/screens/useMobileRemote.ts): `onMobileRequest` deadline check. |

**Keep distinct:** [MobileConnectionLink.tsx](../../../src/components/MobileConnectionLink.tsx) supplies shared pairing presentation, but a phone microphone provides audio rather than presentation controls. [MobileStreamPanel.tsx](../../../src/components/MobileStreamPanel.tsx) concerns public congregation access. Neither establishes controller capability or permission.

**Release check:** actual iOS/Android browsers, approval and revocation, dropped Wi-Fi, desktop interruption, preview changing during use, scripture/song/deck/media actions, clear/restore, and readability. Do not use “control from anywhere,” “works without the desktop,” or a security certification claim. Network restrictions and firewalls may prevent pairing.

## 2. Scripture catches with operator control

- [main.ts](../../../electron/main.ts): recognition handling calls `autoMode.decide` with `manualOnly: true`; `pushPreviewToLive` accepts an explicit operator/remote route; `auto-mode-set` rejects enabling with “Live scripture requires an operator press.”
- [verseDelivery.ts](../../../electron/engine/verseDelivery.ts): `VerseDelivery.promote` is the publication boundary. Reinspect it before any claim about automatic output.
- [quoteMatcher.ts](../../../electron/engine/quoteMatcher.ts): `QuoteMatcher.loadIndex` loads indexed KJV/BSB wordings; quote candidate logic handles quotation evidence. This does not establish equal accuracy across all Bible versions or paraphrases.
- [ScriptureCatches.tsx](../../../src/design/screens/ScriptureCatches.tsx): recent-speech and typed search paths provide fallback. Search result selection can be a live action; avoid presenting every fallback click as preview-only.
- [Teaching.tsx](../../../src/design/screens/dashboard/Teaching.tsx) has a separate per-preacher **voice commands** toggle; [main.ts](../../../electron/main.ts) uses `preacherCommandsEnabled`, `VoiceCommandEngine`, and configured callbacks. Narrow the no-automatic-publication claim to scripture suggestions. Do not imply that all spoken control is impossible or that these settings have no effect on the screen.

**Release check:** a named reference, a distinctive quotation, an ambiguous allusion, and missing audio/transcription. Capture actual successful and unsuccessful results. No numeric accuracy or response-time claim is supported by this inspection. Existing full tutorial: [04](../articles/04-how-scripture-recognition-works.md).

## 3. In-app guide

- [ProductGuide.tsx](../../../src/components/ProductGuide.tsx): `ProductGuide`, guide choices, step actions, prerequisite setup state, retained field answers, and source-revision update listener. The listener pauses an active walk when the app source index changes.
- [guideWalkthroughs.ts](../../../src/lib/guideWalkthroughs.ts): `walkthroughFor`, `guideClickTargets`, `guideWriteTargets`, `canGuideClick`, `canGuideWrite` define the permitted workflows and action targets.
- [guidePrerequisites.ts](../../../src/lib/guidePrerequisites.ts): `guideReadiness` checks stock-provider/Bible readiness and distinguishes unavailable or unknown state. A saved provider key does not prove provider acceptance until a search succeeds.
- [useGuideCursor.ts](../../../src/components/useGuideCursor.ts): cursor motion, target lookup, interaction feedback, and takeover behavior. Check current behavior in the live UI before describing timing or easing.
- [guideIndex.ts](../../../scripts/guideIndex.ts): `guideIndex` builds source/control information and sends `trilorah-guide-map-update` during development. A fresh index does not invent instructions for a newly added feature.
- [Product map README](../../product-guide/README.md): scope, prior isolated UI verification, and remaining hardware/provider checks. The mapped task inventory exceeds the set of executable walkthroughs.

**Release check:** full online-image setup detour, successful search, supported writing fields, existing-draft preservation, user takeover, reduced motion, and update handling. No claim that the guide understands arbitrary language or operates the entire app. It does not type secrets for the user. Existing training article: [14](../articles/14-train-a-new-volunteer.md).

## 4. Programme to prepared run

- [RunHeaderActions.tsx](../../../src/design/screens/run/RunHeaderActions.tsx): `scan` calls desktop image import, opens review, and handles failure with a text-entry route. `onAdd` calls `run.addSegments(rowsToSegments(rows))` and `setServiceSchedule(rowsToSchedule(rows))`.
- The current `RunHeaderActions` renders **Paste**, **Scan**, and `.tri` in the rail's import/footer area; `RunHeaderShortcuts` separately owns add-section/default-order controls. Do not reuse old screenshots or wording that locates the import controls only in the header.
- [ScanReview.tsx](../../../src/design/screens/run/ScanReview.tsx): `read`, `patch`, usable rows, type checks, and explicit add action. Proposed rows remain editable before joining the run.
- [runOfServiceParse.ts](../../../shared/runOfServiceParse.ts): `parseOrderOfService`, parsed rows, and schedule conversion.
- [run.tsx](../../../src/design/screens/run.tsx): run state and segment/content handling.

**Important distinction:** visible segments append; the separate engine schedule is replaced. Reimporting is not a guaranteed update-in-place operation. The source programme supplies structure, not the actual lyric/media assets. Image scanning requires the desktop path. Rehearse the pictured example before publication. Existing tutorial: [16](../articles/16-turn-a-programme-into-a-service.md).

## 5. Preacher-specific corrections

- [ProfileView.tsx](../../../src/design/screens/dashboard/ProfileView.tsx): choosing today's preacher and entering sound check/review.
- [LearningActions.tsx](../../../src/design/screens/dashboard/LearningActions.tsx): sound-check actions; `Correct`, `Wrong reference`, uncertain answers, saved corrections, and missed examples. UI states that only verified answers affect readiness, with missed references kept separately from detected-verse precision.
- [Teaching.tsx](../../../src/design/screens/dashboard/Teaching.tsx): the visible controls are **sounds like** (`soundsLike`), **their words** (`vocabulary`), and **ignored after a verse** (`ignoreTails`). Use the visible labels in reader instructions; property names are implementation evidence. Book-name aliases are applied in reference-like contexts; these are distinct controls, not interchangeable training data.
- [main.ts](../../../electron/main.ts): `teachingFor`, `teachTranscript`, `SoundCheck` construction with `startWhisperLocal`/`stopWhisperLocal`, and Deepgram vocabulary setup. Corrections and vocabulary behavior depend on active profile/settings and the relevant recognition path.
- [preacherLearning.ts](../../../shared/preacherLearning.ts): shared teaching/review records.

**Release check:** first-run local model setup, one sound-check exercise, one verified correction and replay, uncertain/missed examples, and the selected preacher. A sound check uses local speech even when a regular service uses a cloud provider. Do not promise voice cloning, self-training on every sermon, perfect recognition, or automatic live output. Existing tutorial: [15](../articles/15-preacher-sound-check-and-review.md).

## 6. Service packages and handoff

- [TriPackageActions.tsx](../../../src/design/screens/run/TriPackageActions.tsx): `savePackage`, `prepareSave`, `inspect`, `importPackage`, the post-initial-save autosave effect, selected categories, and replacement consent.
- [triClient.ts](../../../src/lib/triClient.ts): `triRendererState`, `selectTriItems`, `applyTriSnapshot`, `stageTriDisplay`, and `SERVICE_CATEGORIES`. Distinguishes opening a service from importing selected material.
- [triPackage.ts](../../../shared/triPackage.ts): package categories, manifest, selected resources, and asset metadata.
- [triBridge.ts](../../../shared/triBridge.ts): inspection/import result and warning interfaces.

**Release check:** save/open/import with songs, media, presentations, and run content on two machines or a clean profile; warnings; canceled save; replacement consent; remote media behavior. First save is deliberate; autosave follows the current file's included-content selection. A package is not a guarantee of offline online-media access or configured destination hardware. Existing tutorial: [11](../articles/11-save-and-transfer-a-service.md).

## Editorial readiness

The user subsequently authorized full drafting in the chosen voice direction. Six complete introductions numbered 17–22, ten headline alternatives each, and three short preview options each are now available in this folder. These are ready for draft review. No publication dates, external posts, generated product screenshots, or new runtime results are implied.

Critical facts remain unchanged on recheck: scripture publication requires an operator action; remote controls require a responding desktop and pairing; direct live actions must be distinguished from preview selection; guide actions are registered and bounded; programme rows append while the schedule replaces; verified preacher feedback and sound-check provider distinctions remain; packages require selected resources and a receiving-machine check. Before publication, exercise each workflow and its visual example in the release build.
