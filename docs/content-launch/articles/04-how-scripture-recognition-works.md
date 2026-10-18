---
title: "How Trilorah finds scripture while the preacher speaks"
slug: "how-scripture-recognition-works"
audience: "Operators and church leaders evaluating sermon recognition"
question: "How do spoken references and quotations become scripture suggestions, and who controls projection?"
proposed_publication_date: "2026-03-13"
schedule_note: "Planning date requested for March–July 2026; not a publication record"
status: "draft — source reviewed; recorded recognition walkthrough and visuals pending"
reviewed_on: "2026-10-18"
task_ids: [scripture.catch-and-project, scripture.recent-speech-search, scripture.phrase-topic-search, preacher.review-recognition]
---

# How Trilorah finds scripture while the preacher speaks

The preacher names a passage. The operator needs the right words on screen while the congregation is still turning to it.

Trilorah can help with the lookup. It listens to transcribed speech, looks for evidence of a Bible passage, and prepares a candidate. A named reference and a quoted passage give it different evidence, so they need different kinds of matching.

Finding a passage is separate from showing it. A recognized reference or quotation becomes a suggestion; the operator or paired remote must explicitly send that suggestion live.

## A reference gives Trilorah an address

“John chapter three, verse sixteen” supplies a book, chapter, and verse. Trilorah works from the transcribed words to resolve that reference and check the passage.

The transcript matters. A misheard book name, unclear number, or unfinished sentence can leave the app with the wrong clue. Context checks help filter weak detections. They cannot guarantee that every reference will be caught, or that every mention of “John” means the Gospel.

A book can arrive before its numbers. Trilorah keeps an unfinished reference for up to 90 seconds so “Genesis chapter” can be followed by “32 verse 24 to 28.” An explicit new book replaces that context. For books with one chapter, “Jude 20” means Jude 1:20.

If it hears “Kings” without a clear first or second, it asks the operator to choose a book. Choose a reference to send it live, or dismiss the question. Check the transcript if the intended book is missing.

## A quotation gives it wording to match

When a preacher quotes scripture without naming the reference, Trilorah can compare recognizable wording with indexed Bible text.

A distinctive phrase supplies stronger evidence than a few common words. An incomplete quotation or a loose paraphrase may fit several passages, or fail to produce a useful candidate.

The current quotation matcher includes KJV and BSB wording. Selecting another Bible for display does not mean the matcher recognizes that translation equally well. What it matches and what you choose to display are separate parts of the process.

## The operator checks the result

Caught passages have individual reference tabs. The latest catch becomes active; previously shown passages remain available there too. **+N** opens the extra tabs. Select a tab to preview it, or use its × to remove it from the list.

Read the caught reference and prepared text. Check the translation and how much of the passage is needed. Send it when the congregation should see it. Repeating a reference, or reading words wholly within the currently live passage, does not create another catch.

The save icon keeps a local bookmark and adds the passage to the current service if it is not already queued. **Saved** opens the bookmarks. Removing a tab leaves its bookmark intact. Unsaving removes the bookmark; remove a queued service item separately in the run of show. Save the service as a .tri file to carry that queued passage with it.

If the candidate is wrong, leave it unshown. Look up a known reference, or search using a remembered phrase, person, event, or topic. **find reference** can also search recent speech, within its recent listening window.

Phrase-search results need care: selecting a result card sends that passage live. Read the result before choosing it. You can close the results without selecting anything.

## What this looks like during a sermon

Suppose the preacher says, “Let's turn to John chapter three, verse sixteen,” then begins reading. A candidate appears. The volunteer checks John 3:16 and the displayed translation, then sends it live.

Later, the preacher loosely recalls another passage. There is too little distinctive wording for a useful catch. The volunteer types what they remember into scripture search, reads the possible matches, and chooses a suitable result only after checking it.

Try both kinds of example with your own speaker and audio setup. Clear speech, a usable input and the wording of the quotation all affect the result.

## Follow a reading that is already live

**Auto advance** follows an already-live scripture. It moves after a near-complete reading reaches the verse’s ending, or when the speaker clearly starts reading the next verse. Quoting a few ending words alone is not enough. If a range occupies several pages, it moves through those pages before going beyond the range. It stops at the chapter’s end.

Use the arrows beside Auto advance or the preview to move manually. With preacher voice commands enabled, “next verse” and “previous verse” update both preview and live. A “next verse” immediately after an automatic step is treated as the same step.

Prayer mode uses configured phrases such as “let us pray” and “bow your heads.” “Amen” ends it. While prayer mode is active, following pauses and the controls show that status. It does not infer every prayer from its meaning. Rehearse with your speaker; switch Auto advance off when you want to hold a verse for explanation.

## Recognized passages wait for your choice

There is no confidence score, sound-check result, or readiness label that sends a caught passage live for you. New scripture suggestions do not publish automatically. Auto advance is a separate, opt-in way to follow a reading you have already put live.

Configured voice commands are separate controls and can affect the screen. Review their settings with your team before the service; a recognition score does not switch them on.

Recognition depends on usable audio, transcription, recognizable wording, and available Bible text. Its value is in helping the operator find a passage and decide what to show next.

For the manual fallback, read [how to find scripture from a phrase](09-find-scripture-from-a-phrase.md). For reviewing saved recognition examples, see [the preacher sound-check and review guide](15-preacher-sound-check-and-review.md).
