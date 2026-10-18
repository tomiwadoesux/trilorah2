# Rewrite review: articles 01–08

Reviewed 11 October 2026 against the current working tree. The founder authorized the rebuild; these are complete revised drafts. Their proposed March–April 2026 dates remain planning dates, not published history. Release walkthroughs, provider tests, hardware checks, and visuals are still pending.

Scope: only articles 01–08 and this review file. Existing frontmatter key names, slugs, task IDs, proposed dates, schedule notes, and readiness status were preserved. `title` and H1 changed together; `reviewed_on` is now 2026-10-11. The shared manifest, calendar, editorial notes, and headline-options file were left for the parent to synchronize.

## Editing passes

1. **Purpose and structure:** made 01 a product introduction organized around preparing and following a service; made 04 an explanation of recognition evidence and the operator decision. The remaining six pieces teach tasks, with ordered steps where sequence matters.
2. **Current facts:** rechecked the actual source files, especially the changed run UI, direct-send scripture controls, microphone/phone setup, stock credentials, media/background behavior, and the automatic scripture projection guard.
3. **Voice and rhythm:** followed `voice-calibration.md` and the subsequent `TONE.md`. Cut repetitive caveats, contrived personification, filler, and invented proof. Used a few short, situational asides; microphone troubleshooting and projection boundaries remain literal. No rejected calendar/preacher jokes were reused.
4. **Usability:** put consequential behavior near its step. Article 04 now explicitly warns that choosing a phrase-search result sends it live. Article 06 explains the current right-click rename and Add items paths. Article 08 distinguishes saving a provider key from a successful provider search.
5. **Mechanical review:** checked all eight H1/frontmatter title pairs, metadata preservation, word counts, and internal Markdown links. Each article is approximately 450–560 words, including its title. No app tests were run for copy changes; source review does not replace the remaining release checks.

## Source and production changes for the shared records

The following descriptions can replace or extend the existing manifest/editorial notes. Line numbers are current inspection anchors, not permanent identifiers.

| Article | Evidence and source paths | Visual or release-check adjustment |
| --- | --- | --- |
| 01 | `src/design/screens/Live.tsx:5518` labels the panel **run of show**. `src/design/screens/run/RunRail.tsx` supplies section cards, the section dialog, queued content and notes. `electron/engine/verseDelivery.ts:35` still restricts promotion to explicit operator/remote sources. | Use the current **run of show** panel and section cards in the overview image. Keep preview/live labels and the actual operator-send recording. Do not use website/design-preview data as proof of the desktop app. |
| 02 | `src/design/screens/run/RunHeaderActions.tsx:138` opens **Add a section**. `src/design/screens/run/RunRail.tsx:204` opens **Add items**. `src/design/screens/run/RunContentPicker.tsx:91` supplies Notes and **Add note**. `src/design/screens/Live.tsx:1896` previews a verse row; adjacent double-click/Enter handlers send it. The reference submission handler also stages and sends. `src/design/screens/run/TriPackageActions.tsx:150` requires an active path/selection before autosave. | Add the three run files to the source list. The four-item practice visual should show current section cards. Retain actual-hardware output, clear/restore, and initial-save checks. The practice sermon is not an isolated sandbox. |
| 03 | `src/components/MicPicker.tsx` selects inputs and warns that changing input restarts listening. `src/components/PhoneMicPanel.tsx:136` separates **Allow microphone** from **Use phone audio**; the latter saves the phone input and starts listening. The panel states same Wi-Fi and internet for connection. `src/design/screens/engine.tsx:569` updates the listening state before the asynchronous input setup finishes. | Existing visuals remain useful. A phone sequence should now use the exact labels **Allow microphone** and **Use phone audio**, then show fresh words. Mask codes and identifying device names. No cloud-engine key configuration walkthrough is claimed. |
| 04 | `electron/main.ts:1323` marks speech detections `manualOnly`; `electron/main.ts:2123` rejects enabling automatic mode. `electron/engine/verseDelivery.ts:35` blocks automatic push sources. `electron/engine/quoteMatcher.ts:193` identifies KJV/BSB quotation wordings. `src/design/screens/ScriptureCatches.tsx:247` sends a selected result via `pushReference`. | The recording still needs a real reference/quotation example. A third optional crop could label a phrase-result card as a direct-send control. Describe limits as limits on **recognized scripture/suggestions**; do not claim the app has no spoken controls of any kind. |
| 05 | `src/design/screens/dashboard/outputs/fromEngine.ts:68` defines automatic/off choices; `saveRole` and `saveDisplay` persist assignments. `src/design/screens/dashboard/outputs/types.ts` distinguishes roles and windowed fallback. `src/design/screens/Settings.tsx:127` contains display/output preferences. | Existing output-tile screenshot and physical-display test image remain suitable. Use real desktop hardware, never sample design-preview screens. A stream output still does not establish that an external broadcast is configured. |
| 06 | The old header-media/note-tile limitation is stale. `src/design/screens/run/RunHeaderActions.tsx:138`, `src/design/screens/run/RunRail.tsx:35`, and `shared/runCards.ts:3` define the working section picker. `RunRail.tsx:204` and `RunContentPicker.tsx` provide **Add items**, saved lyric sections, images/videos/slides, import, scripture and notes. `RunRail.tsx:119` guards queued-item publication on usable content. `src/design/screens/run/ContextMenu.tsx:50` provides right-click and keyboard menus. The default run still replaces the existing one after confirmation. | Replace the old “add segment” screenshot request with **Add a section** and section cards. Replace the old note-plus request with section → **Add items** → **Notes** → **Add note**. Test a saved song section, an imported visual, a note, reordering, and save/reopen. Remove the warning that the header media/note route is unwired; it describes the superseded UI. |
| 07 | `src/design/screens/songs/SongLyricsEntry.tsx` splits input into sections. `SongEditor.tsx:529` exposes split/merge/duplicate, with move controls nearby; its save labels and limited temporary-draft prompt remain. `AddSongDialog.tsx` distinguishes online discovery from YouTube captions, returns words to the editor, and requires saving. `src/design/screens/Live.tsx` retains separate lyric preview and **Go live** controls. | Existing editor/section screenshots remain useful. The practice text should be original. Keep the create/save/reopen check and actual preview/send rehearsal. Online discovery must be demonstrated with a real successful response or honest failure state. |
| 08 | Add `src/design/screens/Settings.tsx:167`, `src/design/screens/settingsRows.tsx:375`, and `src/design/screens/StockCredential.tsx` to the source list. Pixabay/Pexels inputs save through `setSetting`, refresh provider presence, and explicitly say search checks whether the provider accepts the key. `src/design/screens/stockSearch.tsx:120` awaits download before `onPick`. `src/design/screens/Live.tsx:966` distinguishes standalone media preview from theme preview/live double-click. | Keep the import and background/standalone comparison shots. Optional new image: **Settings → API keys**, cropped to a provider row after saving, with its key-acceptance note visible and no secret shown. Test successful search/download separately from save, plus rejected-key and unavailable-provider states. Do not claim every remote link is available offline. |

## Headline review

The first option in each list is the selected title. The other nine are alternatives, not additional articles. Selection favors a clear promise and a distinct role in the library; attitude can live in the opening instead of making every title a joke.

### 01 · Product introduction

1. **Meet Trilorah: ready for the next part of the service** — chosen; joins preparation to operation without claiming perfect automation.
2. Meet Trilorah: one workspace for the service ahead
3. Prepare the service. Follow what happens next.
4. Your first look at Trilorah
5. Songs, scripture, slides: meet Trilorah
6. A place for the service plan and everything in it
7. From the welcome slide to the closing words
8. What Trilorah does at the presentation desk
9. Get the next part of the service ready
10. Meet the workspace behind your church screens

### 02 · First-service checklist

1. **Your first Trilorah service starts with a rehearsal** — chosen; says what to do before the actual service.
2. Four items. One useful Trilorah rehearsal.
3. Before your first service: six checks in Trilorah
4. Rehearse the screens before the room fills
5. Run a practice service in Trilorah
6. The first-service checklist for your presentation desk
7. Get through your first rehearsal in Trilorah
8. Check the content, the screen, and the fallback
9. Learn the live controls with a small practice service
10. What to check before you run Trilorah on Sunday

### 03 · Microphone setup

1. **Connect a microphone and check it in Trilorah** — chosen; connects setup to a measurable result.
2. Check the sound. Then check the words.
3. Make sure Trilorah can hear the sermon
4. A microphone check needs more than a moving meter
5. Choose the right audio input in Trilorah
6. From microphone to transcript: your first audio check
7. Connect your audio and confirm fresh speech
8. Test sermon listening before the service
9. Set up a microphone or phone input in Trilorah
10. The two checks that finish microphone setup

### 04 · Recognition explanation

1. **How Trilorah finds scripture while the preacher speaks** — chosen; identifies the feature and the real situation.
2. From spoken reference to scripture suggestion
3. What happens when Trilorah hears a Bible verse
4. A reference, a quotation, and an operator's decision
5. How scripture recognition works in Trilorah
6. The passage is suggested. You decide when to show it.
7. Inside a scripture catch
8. When the preacher names the reference—and when they don't
9. What Trilorah listens for during a sermon
10. Finding scripture without handing over the screen

### 05 · Screens

1. **Get Trilorah onto the right screens** — chosen; directly answers the beginner's task.
2. Give each output a job and a destination
3. Set up your projector, stage display, and timer
4. The laptop looks right. Check the room.
5. Assign and test your Trilorah displays
6. Put the service where people can see it
7. Check every screen before the service
8. Connect a projector and verify the output
9. Which screen gets which content?
10. From output settings to the actual projector

### 06 · Service preparation

1. **Build a service another volunteer can run** — chosen; makes handoff the practical outcome.
2. Put the content and the cues in the service plan
3. Prepare a run of show in Trilorah
4. Leave the next volunteer a usable service
5. Build the order, then add what belongs in it
6. A service plan you can hand over
7. Organize your service into sections
8. Get the welcome, worship, and sermon ready
9. Add the detail your service plan needs
10. Turn a list of sections into a prepared service

### 07 · Songs

1. **Get the lyrics right before the first song** — chosen; gives a real preparation priority.
2. Prepare the song your worship team will actually sing
3. Build and check lyric slides in Trilorah
4. Same title. Check the arrangement.
5. Add a song, arrange the slides, save the words
6. Make the next lyric section easy to follow
7. Get a saved song ready for Sunday
8. From lyric text to a rehearsed song
9. Check the verses, repeats, and slide breaks
10. Prepare lyrics the congregation can follow

### 08 · Media

1. **Add images and videos to Trilorah** — chosen; keeps the broad task easy to find, with the media/background distinction in the opening.
2. A picture for the screen—or behind the words
3. Prepare images and videos for your service
4. Import a visual, preview it, then send it
5. Choose what your next image should do
6. Get an online visual ready for the service
7. Media and backgrounds: choose the right path
8. Put an image on screen with confidence
9. From local file to live visual
10. Check the video beyond its thumbnail

## Remaining publication work

Synchronize chosen titles and the source/visual changes above into the shared records. Capture the actual current interface after the working-tree changes settle, run each specified release check, and review the complete pages with their final visuals. The illustrative recognition scenario is deliberately labeled; do not replace that label with an untested accuracy claim.
