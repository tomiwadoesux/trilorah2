# Preacher learning — conversation summary and handoff

Date: 2026-09-28

## Current status

The local-first preacher-learning implementation has been added to this working tree. The latest production build and TypeScript check passed. Earlier focused verification passed 68 tests across preacher learning, review, vocabulary, command logging and Whisper output handling.

**End-to-end microphone operation is not yet confirmed.** An isolated Electron check verified several persistence and IPC steps, but the complete sound-check run did not finish successfully. Do not describe the whole feature as fully working yet.

The user asked to stop testing, save this summary, and continue later. No further tests or implementation changes were made after that request. The last running smoke check had already exited. No commit or deployment was made.

## Summary of the last four exchanges

### 1. Other training methods, workload and accents

The user liked learning from operator corrections, but asked whether it would overwhelm the system. They also asked whether public recordings or prediction systems could help with accented English, such as recognising how an Indian preacher says “Proverbs.”

We discussed a bounded review queue, an optional short sound check with known Bible references, and learning from explicitly verified corrections during normal services. An operator choosing a different verse is only a review candidate: they might have moved to a new passage rather than corrected a mistake.

Public resources researched:

- [Speech Accent Archive](https://accent.gmu.edu/browse/): listen to English spoken by people from different language backgrounds.
- [L2-ARCTIC](https://psi.engr.tamu.edu/l2-arctic-corpus/): non-native English recordings with pronunciation annotations.
- [AfriSpeech-200](https://huggingface.co/datasets/intronhealth/afrispeech-200): African-accented English; its published licence includes a noncommercial restriction.
- [Deepgram supported languages](https://developers.deepgram.com/docs/models-languages-overview/): Nova-2 supports Indian English (`en-IN`).

These datasets are not ready-made dictionaries predicting exactly how an individual will pronounce every Bible book. An English-variety selection can provide a starting point where the recogniser supports it, but individual examples and Bible-reference context remain important.

### 2. Zero or almost-zero recurring cost

The user made cost the priority: $0 or as close to it as possible.

The chosen direction was local speech recognition plus a small correction memory for each preacher. The teaching logic does not need paid AI calls or custom voice-model training. Use the existing local Whisper path, save approved corrections locally, and offer an optional short practice exercise.

The tradeoff is hardware use and delay. The current local implementation collects approximately five-second audio chunks before processing. Actual accuracy and response time on a church computer remain to be measured.

An accent selector was deferred: the local code currently reduces English language varieties to `en`, so such a selector would not change its recognition behaviour. Large accent datasets and custom model training were also deferred.

**Cost scope:** the new sound check and learning logic use no paid AI APIs. Service speech defaults to local unless Deepgram is explicitly selected. Existing cloud notes and other cloud features were not converted to local operation; this is not a claim that every feature of the application is free of cloud costs.

### 3. “Do it” — implementation authorised

The user explicitly authorised implementation. Changes added:

- Persistent per-preacher teaching for book-name corrections, vocabulary, ignored trailing phrases and the voice-command toggle.
- Context-limited book-name corrections: an approved mishearing is replaced when followed by a chapter or number cue, rather than throughout ordinary prose.
- Exact whole-utterance memory for human-approved reference corrections, preserving numbers rather than using fuzzy number substitutions.
- Durable review examples attached to their original preacher and service.
- No silent confirmation at service end. Unreviewed examples remain unverified.
- Idempotent review answers: answering the same example twice cannot inflate trust.
- “Correct,” “Wrong reference,” “Not a reference,” and “Can’t tell / new passage” review choices.
- Manually entered missed-reference examples, kept separate from detected-verse precision.
- A bounded queue of 200 examples per preacher, showing five by default.
- Legacy totals that included unreviewed confirmations are preserved but excluded from verified readiness.
- Readiness stages and thresholds taken from the engine; real available history and profile habits loaded into the page.
- An isolated local sound check for Proverbs 3:5, 1 John 4:8 and Romans 8:28. It does not change the projector, enter the sermon pipeline, or add trust samples.
- Session-specific sound-check cancellation to prevent stale UI cleanup from stopping a newer check.
- A one-time download of a pinned Windows x64 whisper.cpp CPU executable, with SHA-256 verification. The existing model download supplies the speech model.
- Local speech remains the default even when cloud credentials exist; cloud recognition requires explicit selection.
- Recognition practice and review above the statistics; advanced teaching grouped below.

The UI does not save audio clips for review. The sound check processes temporary audio chunks, which the existing local transcription path removes after processing; review examples contain transcript text.

### 4. Pause testing and save the conversation

The user asked for a Markdown summary of the last four exchanges, saved in the project, and said testing could continue later. This file is that handoff.

## Important findings behind the changes

The original page showed teaching controls that only changed temporary React state. Its readiness stages used fixed UI thresholds that could disagree with engine settings. Most seriously, unresolved detections were automatically counted as correct when a service ended. Review resolution also used the currently selected preacher rather than reliably preserving the originating preacher.

The feature is adaptation through approved corrections and vocabulary. It is not acoustic-model fine-tuning or voice cloning.

## Main files added or changed

New files:

- `shared/preacherLearning.ts` — teaching, review-detail and sound-check contracts.
- `electron/preachers/teaching.ts` — local teaching persistence and contextual book aliases.
- `electron/preachers/soundCheck.ts` — isolated sound-check controller.
- `electron/asr/offlineRuntime.ts` — pinned Windows CPU runtime download and verification.
- `src/design/screens/dashboard/LearningActions.tsx` — sound check and review controls.
- `electron/preachers/teaching.test.ts`
- `electron/preachers/soundCheck.test.ts`
- `electron/asr/provider.test.ts`
- `scripts/preacher-learning-smoke.cjs` — isolated Electron integration check using synthetic audio when available.

Existing files changed include `electron/main.ts`, `electron/preload.ts`, `electron/preachers/correctionLedger.ts`, its tests, `electron/asr/provider.ts`, `electron/asr/whisperLocal.ts`, `shared/types.ts`, `src/types/api.d.ts`, `src/App.tsx`, and the dashboard's `ProfileView.tsx`, `Teaching.tsx`, `PreachersTile.tsx` and `preachers.ts`.

There were many unrelated pre-existing working-tree changes when this work began. Preserve them. Do not reset the working tree or assume every current diff belongs to this task.

## Verification already performed

- Production build and TypeScript checking passed after the latest implementation edits.
- 68 focused tests passed at an earlier checkpoint. Later edits and the new provider test have not all been rerun; do not treat the 68-test result as validation of every final edit.
- Downloaded Windows whisper.cpp v1.8.3 CPU archive matched the pinned SHA-256 digest. Its executable successfully returned its help output on this machine.
- A synthetic WAV saying “Proverbs chapter three verse five” was generated locally for the isolated check. The real microphone was not used.
- The isolated Electron check exercised profile creation, teaching persistence, missed-example review after changing preacher, duplicate-answer rejection, and offline selection.
- The first complete-check attempt stopped the sound check during a page reload. Session-specific cancellation and waiting for reload completion were then added.
- The most recent retry exited with a renderer script execution error before confirming local audio recognition. Investigate the smoke harness first; the recently added selector for closing the tour may have a JavaScript quoting issue. This is a hypothesis, not a confirmed diagnosis.
- A screenshot was generated at `artifacts/preacher-learning/profile.png`; the earlier capture still had the welcome-tour overlay. It is not final visual approval.
- The build reported CSS and bundle-size warnings elsewhere in the application. They did not fail the build.

## Continue later

1. Inspect the latest smoke-script renderer error, particularly the tour-close selector quoting. Do not confuse a test-harness failure with a confirmed recognition-engine failure.
2. Rerun the focused tests after the final edits, including provider selection and sound-check cancellation.
3. Complete the isolated synthetic-audio check, confirming a matched reference, unchanged projector state and unchanged trust score.
4. Inspect the page after dismissing the tour, including advanced controls, save errors and a populated review list.
5. Check real service lifecycle behaviour: preacher changes, finishing a service, late review, application restart and deletion/recreation of a profile. Legacy vocabulary and command files deserve a follow-up check when deleting/recreating an ID.
6. Check that the free-speech choice and any separately enabled paid cloud features are clearly distinguished to the operator.
7. Later, with the user ready, measure latency and accuracy using the actual service microphone and real preacher speech. Synthetic speech does not establish accent performance.

Do not add mandatory voice training, an ineffective accent dropdown, or paid model training to this first version without a new decision from the user.
