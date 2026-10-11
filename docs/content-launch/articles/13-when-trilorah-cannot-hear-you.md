---
title: "Trilorah cannot hear the preacher: check the problem in three stages"
slug: "when-trilorah-cannot-hear-you"
audience: "An operator troubleshooting sermon listening"
question: "Is the problem the audio input, transcription, or scripture recognition?"
proposed_publication_date: "2026-06-23"
schedule_note: "Planning date requested for March–July 2026; not a publication record"
status: "draft — source reviewed; hardware/error-state walkthrough and visuals pending"
reviewed_on: "2026-10-10"
task_ids: [audio.troubleshoot, audio.choose-input, audio.start-stop-listening, scripture.catch-and-project, notifications.resolve]
---

# Trilorah cannot hear the preacher: check the problem in three stages

When no scripture appears, it is tempting to change several settings at once. A clearer approach is to check the path in order: audio arriving, words being transcribed, and scripture being recognized.

Each stage gives you different evidence. A moving level, a transcript, and a suggested passage answer different questions.

## Stage 1: is sound reaching Trilorah?

Open **Audio** beneath the operator preview and check the selected input. Confirm that it is the microphone or soundboard feed you intend to use.

Start listening and speak into that source. If the level does not respond, check the hardware connection, the source's mute state, and the computer's microphone permission.

If you reconnected an interface, inspect the input list again. Device names can change, and a previously selected device may no longer be available. Choosing another input while listening restarts the capture path, so repeat the check afterward.

For a phone microphone, confirm both that the phone is connected and that **use phone audio** was selected. A connection status alone does not mean the phone is the active listening source.

## Stage 2: are new words appearing?

If the audio level responds, say a complete sentence you have not used in this check. Look for new transcript text.

No new words can mean the speech engine is still preparing, has reported an error, or cannot use its required resources. Read the status and any notification. A local engine needs its model; a cloud engine needs valid configuration and connectivity.

The listening control may update before the engine finishes starting. Avoid treating the button's appearance as a successful transcription test.

A saved transcript from earlier in the session also does not prove that this input is working now. Use fresh speech as your evidence.

## Stage 3: do those words identify scripture?

When new words appear but no passage is suggested, read what was transcribed. Did it contain the full book, chapter, and verse? Was the book name or number misheard? Was the quotation distinctive enough to identify a passage?

Try one complete reference during rehearsal. If that works but a loose paraphrase does not, you have learned something about the recognition example rather than proving the microphone failed.

During a service, use manual reference lookup or the phrase search as the fallback. Check a candidate before sending it live. The current runtime does not automatically project scripture from speech.

## Use notifications as directions

An active notice can point to the relevant audio or configuration controls. Follow its destination and read the actual problem.

Dismissing a notice only hides it; it does not restore a microphone or finish a model download. If you ask for help, include the notice wording and the last stage that worked: for example, “The level moves, but no new transcript appears.”

## Know what a practice test proves

The practice sermon can exercise the recognition flow with simulated recognizer text. It cannot verify microphone capture or the accuracy of your real speech engine. Use it during rehearsal; it shares the real recognition and output pathways.

Once the issue is resolved, repeat a real sentence and a complete reference. That closes the loop with current evidence rather than a setting that merely looks correct.

For initial setup, follow [the microphone guide](03-connect-a-microphone.md). For recognition expectations, read [how scripture recognition works](04-how-scripture-recognition-works.md).
