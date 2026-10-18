# Rewrite review: articles 09–16

Reviewed 11 October 2026 against the current working tree. The founder's corrections in [voice-calibration.md](voice-calibration.md) override the exploratory brand-study examples. These are edited drafts for review, not published articles. The proposed March–July dates remain planning metadata.

The rewrite keeps personality in concrete observations and editorial choices. Troubleshooting stays literal. A parenthetical line appears only where it adds something: the back-row readability article makes the required walk part of the joke. Generic self-congratulation was removed from the handoff and programme articles in the final pass. None of the rejected calendar, preacher or booth personification is used.

## Headline options

The first option in each list is selected and matches the article's frontmatter and H1. The other nine are alternatives, not publication commitments.

### 09 · Scripture search

1. **Find a Bible passage from the words you remember** — selected
2. Remember the words? Find the passage in Trilorah
3. Find scripture without knowing the chapter and verse
4. Search the Bible by a phrase, person or story
5. Find the passage the preacher just mentioned
6. A reference is useful. A remembered phrase can work too.
7. Turn a half-remembered passage into a useful search
8. Search recent speech for scripture in Trilorah
9. What to type when you cannot remember the reference
10. From a remembered phrase to the right passage

### 10 · Quick slides and presentations

1. **Make an announcement slide or import a presentation** — selected
2. One announcement. One slide. Here's how.
3. Bring the speaker's presentation into Trilorah
4. Create a welcome slide before the service
5. Quick slide or imported deck? Choose your starting point
6. Get your announcements ready for the room
7. The speaker sent a presentation. Check these things next.
8. Prepare a deck you have actually looked through
9. Build a simple announcement and put it in the service
10. Check every imported slide before Sunday

### 11 · Service handoff

1. **Save your service. Open it on the church computer.** — selected
2. Move a Trilorah service to another computer
3. A service handoff that includes the actual content
4. Save, open or import? A guide to .tri files
5. Prepare at home. Check it at church.
6. What to send the volunteer running your service
7. Make sure the service file has what Sunday needs
8. Your service is saved. Now check the other laptop.
9. Keep a separate file for next week's service
10. How to finish a service handoff in Trilorah

### 12 · Readable projection

1. **Make your slides readable from the back row** — selected
2. Check your lyrics where the congregation sits
3. A better background starts with readable words
4. Give projected scripture room to breathe
5. Can the back row read your slide?
6. Choose text and backgrounds that work in your room
7. Test the long verse, not just the short chorus
8. Make the words the easiest thing to see
9. Adjust scripture and lyric layouts in Trilorah
10. Before you settle on that background, read the slide

### 13 · Troubleshooting

1. **No scripture appearing? Check sound, words, then recognition.** — selected
2. Find out why Trilorah is missing the sermon
3. The level moves, but no transcript appears. What next?
4. Troubleshoot listening one stage at a time
5. Check the microphone before changing recognition settings
6. Get from a silent input to a useful scripture suggestion
7. Is the problem the sound or the scripture?
8. What to check when Trilorah cannot hear you
9. Three checks for missing scripture suggestions
10. Follow the audio before you blame the search

### 14 · Volunteer training

1. **Train a new volunteer by running a small service** — selected
2. Give the new volunteer the mouse
3. One rehearsal is a better first lesson than every menu
4. Teach preview, live and the next thing to do
5. A first Trilorah session your volunteer can practise
6. Help a new operator handle a change of plan
7. Train the actions your Sunday service needs
8. Build confidence with a four-part practice service
9. Show it once. Let the volunteer try it.
10. What a new presentation volunteer should practise first

### 15 · Preacher sound checks and corrections

1. **Help Trilorah recognise your preacher’s references** — selected
2. Review a missed reference and teach the correction
3. Run a sound check with the preacher's microphone
4. Work on the reference Trilorah keeps mishearing
5. Give recurring recognition mistakes a specific correction
6. Use preacher profiles to check what Trilorah heard
7. From a misheard book name to a tested correction
8. Make a sound check useful after it finishes
9. Review scripture suggestions without guessing
10. What to put in your preacher's teaching profile

### 16 · Programme import

1. **Turn the programme in your group chat into a service plan** — selected
2. Paste the programme. Prepare the service.
3. Start your Trilorah run from a message or photo
4. Get the service order into Trilorah without retyping it
5. Scan a programme, check the rows, add the content
6. Turn a printed programme into a run you can rehearse
7. The plan has arrived. Here's what to do with it.
8. Import the order of service and finish the preparation
9. From the church-office message to the operator's run
10. Give your copied programme the content it still needs

## Editing and source verification

These are source checks, with one direct parser check. No hardware, live congregation, private transcript or current service was accessed. No product code was changed. App and hardware walkthroughs remain necessary before publication.

| Article | Editing result and checked behaviour | Current source evidence |
|---|---|---|
| 09 | Leads with a remembered clue. Steps explain phrase search; a table preserves the different Enter/click behaviours. Spelling undo, unavailable meaning search, desktop requirement and recent-speech limits remain explicit. | [ScriptureCatches.tsx](../../src/design/screens/ScriptureCatches.tsx): `search`, `find`, result-card `pushReference`; [Live.tsx](../../src/design/screens/Live.tsx): reference `onSubmit` and verse-row handlers |
| 10 | Separates quick-slide creation from imported-deck preparation. Corrects the body-field wording to points. Explains static images, name-only imported editing and conversion prerequisites without making the reader learn the conversion pipeline. | [presentations.tsx](../../src/design/screens/presentations.tsx): `QuickSlideModal`, `SlidesBrowser`; [main.ts](../../electron/main.ts): `import-presentation`; [pptxConverter.ts](../../electron/media/pptxConverter.ts): required LibreOffice and Poppler executables |
| 11 | Uses a decision table for Open versus Import and a concrete receiving-computer checklist. Keeps first-save, autosave selection, replacement and append semantics. Does not promise that web links work offline. | [TriPackageActions.tsx](../../src/design/screens/run/TriPackageActions.tsx): save, selection, replacement confirmation and labels; [triClient.ts](../../src/lib/triClient.ts): `applyTriSnapshot` |
| 12 | Makes the physical reading check the opening action. Uses actual theme labels and a specific longest-content test. Distinguishes preview from background changes that can affect LIVE. Avoids universal size prescriptions. | [Live.tsx](../../src/design/screens/Live.tsx): `ThemesEditor`, `pickBackground`, theme update handling; [backgroundDrop.ts](../../src/lib/backgroundDrop.ts); [SongEditor.tsx](../../src/design/screens/songs/SongEditor.tsx) |
| 13 | Puts a three-row diagnostic table first. Separates audio level, fresh transcript and recognition. Distinguishes connected phone from active phone input; keeps practice text separate from real capture. No comic aside in error recovery. | [MicPicker.tsx](../../src/components/MicPicker.tsx): `choose`; [PhoneMicPanel.tsx](../../src/components/PhoneMicPanel.tsx): Use phone audio; [micCapture.ts](../../src/lib/micCapture.ts); [practiceSermon.ts](../../electron/asr/practiceSermon.ts); [NotificationCenter.tsx](../../src/components/NotificationCenter.tsx) |
| 14 | Opens with a training opinion and a small real task. Explains guide actions as real workspace actions, distinguishes the separate simulated microphone demo, and keeps physical-equipment verification. Adds a concise live-send table. | [ProductGuide.tsx](../../src/components/ProductGuide.tsx): choices, demo, pause and guide entry; [guideWalkthroughs.ts](../../src/lib/guideWalkthroughs.ts); [Live.tsx](../../src/design/screens/Live.tsx): verse and clear/restore handlers |
| 15 | Keeps sound check, review and teaching distinct. Corrects teaching UI labels to sounds like / their words / ignored after a verse. Describes the local sound-check engine separately from the regular speech provider. Limits automatic-projection wording to recognition/readiness and notes the separate voice-command setting. | [ProfileView.tsx](../../src/design/screens/dashboard/ProfileView.tsx); [LearningActions.tsx](../../src/design/screens/dashboard/LearningActions.tsx); [Teaching.tsx](../../src/design/screens/dashboard/Teaching.tsx); [verseDelivery.ts](../../electron/engine/verseDelivery.ts); [main.ts](../../electron/main.ts): manual-only detection and rejected auto-mode enable |
| 16 | Starts from the actual group-chat handoff. Corrects entry labels to Paste / Scan in the run footer, then read it / add to run. Preserves appended run versus replaced schedule and the need to supply lyrics/media afterward. | [RunHeaderActions.tsx](../../src/design/screens/run/RunHeaderActions.tsx): buttons and `onAdd`; [ScanReview.tsx](../../src/design/screens/run/ScanReview.tsx): review labels and row edits; [runOfServiceParse.ts](../../shared/runOfServiceParse.ts) |

### Direct programme-example check

The exact fenced text from article 16 was passed to the current `parseOrderOfService` function with the existing Node/tsx runtime. Result: Welcome at 10:00 for 5 minutes; Worship at 10:05 for 20; Sermon at 10:25 for 30; Closing at 10:55 for 5. All four titles, segment types, start times and durations matched. This does not verify OCR of a photograph.

## Visuals to make or refresh

The existing [editorial notes](editorial-notes.md) remain the fuller production brief. These are the changes or priorities from this rewrite:

| Article | Visual need |
|---|---|
| 09 | Crop the two search fields with their labels; capture a real result card showing its go-live action. The interaction table stays as text, not an image. |
| 10 | Use the original lunch example in Quick slide and a small original deck for the import. Capture a later page as well as the first; verify conversion dependencies on the capture computer. |
| 11 | Capture resource selection and replacement consent without personal paths. The Open/Import comparison can remain a normal HTML table; it does not require a decorative diagram. |
| 12 | Keep identical text and crop for the before/after. Add a real back-row photo if available; do not present a mock room as a completed test. |
| 13 | The diagnostic table now carries the decision structure. An optional simple flow diagram should add no extra branches. Show real test-state notices only. |
| 14 | Capture the current Show me / I’ll do it choice and a brief captioned cursor movement. Label the separate microphone simulation if it is shown. |
| 15 | Refresh screenshots because the teaching labels differ from the first draft. Use an original test preacher and synthetic review example. |
| 16 | Capture the current Paste / Scan footer controls, exact sample review and prepared run. The parser result is verified; an actual image scan still needs recording. |

Before release, check links, article metadata, current UI labels and every stated runtime gate. Keep screenshots and their captions tied to the build used for the final walkthrough.
