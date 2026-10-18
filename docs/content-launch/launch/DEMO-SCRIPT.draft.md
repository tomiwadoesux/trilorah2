---
title: "Trilorah first look — short demonstration"
status: "draft — recording plan; all results must be captured from the intended release"
reviewed_on: "2026-10-17"
target_length: "About 90 seconds; adjust after an honest rehearsal"
audience: "A church volunteer seeing Trilorah for the first time"
---

# Trilorah first look

Show one believable sequence: a prepared service, a spoken reference, a quoted passage and the operator deciding what reaches the screen. Keep the app and a small view of its real output visible when that distinction matters.

## Recording script

| Approximate time | Show | Say |
| --- | --- | --- |
| 0–6s | A prepared rehearsal run: welcome, one song, scripture and closing. | “This is Trilorah. Songs, scripture, slides and media, with the service order beside them.” |
| 6–17s | Open a section, choose **Add items**, and add one prepared item. Keep its title readable. | “Prepare the service in a run of show. Add the material you need, with notes for the person operating.” |
| 17–25s | Open the item to preview it. Show the unchanged live output, then press its **Go live** control. | “Check the next item here. Send it live when you’re ready. Watch the output change.” |
| 25–40s | Open **Audio**, show the already prepared input, and press **Start listening**. Speak the reference into the real input; let the transcript and result arrive. | “With audio and a speech engine set up, Trilorah can help find scripture. ‘John chapter three, verse sixteen.’” |
| 40–49s | Inspect the genuine catch’s reference, translation and text. Select the card to preview; deliberately press its **live** button. | “Check the suggestion. This catch needs your choice before it goes live.” |
| 49–69s | Speak “The Lord is my shepherd; I shall not want.” Show the genuine Psalm 23:1 candidate if found. Preview it while John 3:16 remains live; leave it unprojected. | “A quotation can help too, even without a spoken reference. Here’s the suggested passage. Previewing it leaves the current scripture on screen.” |
| 69–81s | Keep the suggestion and output side by side. Add a short legible caption explaining Auto advance; do not demonstrate it with invented movement. | “Auto advance is separate. If you turn it on, it follows scripture already live and can move to the next verse in that chapter.” |
| 81–90s | Stop listening. End on the rehearsal guide’s real destination. | “Recognition can miss. You can still look up a passage yourself. Start with a small rehearsal using the first-service guide.” |

## Captions and written equivalent

Use captions throughout, including the two spoken test inputs. Keep these extra labels near the relevant UI:

- **Rehearsal material** — on the opening workspace.
- **Preview** and **Live output** — on the two views during the send action.
- **Suggestions depend on clear audio and supported matching** — during recognition.
- **Auto advance is optional and is disabled each time you launch Trilorah** — during its explanation.

Place this short written equivalent under the video:

> Trilorah brings prepared service content and the run of show into one workspace. With a working audio input and speech engine, it can suggest scripture from spoken references and recognisable quotations. Check the passage and use its live control to present it. Optional Auto advance follows speech through scripture already live; manual lookup remains available when recognition misses. Begin with the first-service rehearsal.

## Screenshots to take from the same session

1. **Prepared run:** crop wide enough to show the service order and preview, with readable item titles. Caption: “A small rehearsal service, prepared in the run of show.”
2. **Scripture suggestion:** show a real caught reference, translation, passage text and **live** action. Caption: “A caught passage ready for the operator to check.”
3. **Preview beside output:** show Psalm 23:1 being previewed while John 3:16 remains live. Caption: “The next passage in preview; the current passage remains on screen.”

The recording shows motion and actual recognition. The screenshots help readers inspect the result; they do not prove speed or accuracy.

## Internal production checks — do not render

- Record the intended downloadable release, its version and the speech engine used. Source-reviewed code is not a substitute for this recording. [Release configuration](../../../web/src/app/download/release.ts) currently points to v0.4.8; this draft does not verify installed assets.
- Rehearse with a real prepared input, installed model or working provider configuration, an assigned test output and original rehearsal content. Choose a translation available to that release and check the exact wording. The short quoted phrase above is familiar public-domain KJV wording; do not imply that every paraphrase or translation will match it equally well.
- Use a rehearsal account/configuration and explicitly check cloud/public-sharing behaviour before starting listening. Keep attendee information, real sermon material, API keys, account details and pairing secrets out of the capture. See [desktop evidence](../../legal/evidence-desktop.md) and [web/cloud evidence](../../legal/evidence-web-cloud.md). Do not caption this “entirely offline” merely because local speech is selected.
- Keep **Auto advance** and any configured output-changing voice commands off for the reference/quotation sequence. The delivery gate and separate reading follower have different responsibilities. Verify the separate explanation against [verseDelivery.ts](../../../electron/engine/verseDelivery.ts), [AutoAdvance.tsx](../../../src/design/screens/AutoAdvance.tsx) and [autoAdvanceStore.ts](../../../src/stores/autoAdvanceStore.ts).
- Check exact current control names against [RunRail.tsx](../../../src/design/screens/run/RunRail.tsx), [RunContentPicker.tsx](../../../src/design/screens/run/RunContentPicker.tsx), [Live.tsx](../../../src/design/screens/Live.tsx) and [CatchesPane.tsx](../../../src/design/screens/CatchesPane.tsx). The catch button currently reads **live**; the run-item button reads **Go live**.
- Capture genuine transcript and catch events. Do not type a result into a mock interface or splice a manual lookup into the recording as though speech recognition produced it. If a match fails, review the setup or show the miss and manual recovery accurately.
- Route the clean test speech to the recogniser separately from the explanatory voiceover, so narration does not become extra input. Keep the test words audible to the viewer and label their resulting transcript accurately.
- Timings are an edit plan, not a response-time promise. Keep recognition waits visible, or label any time cut explicitly. Do not speed up the UI or speech to imply faster recognition. If the honest sequence needs longer than 90 seconds, shorten the introduction or allow a longer recording.
- Use the app’s actual cursor and ordinary legible zoom/click emphasis. Do not overlay a simulated Messenger cursor and present it as evidence of companion behaviour. Make a separate companion demonstration when the supported guide is ready to verify.
- Record at readable scale, include captions, keep enough contrast for small controls and provide the written equivalent. Turn music down under speech if music is used at all.
- No recording, screenshot or rendered video has been created by this document. Convert the ending guide action to an actual working public destination before publishing.
