---
title: "How Trilorah recognizes scripture during a sermon"
slug: "how-scripture-recognition-works"
audience: "Operators and church leaders evaluating sermon recognition"
question: "How do spoken references and quotations become scripture suggestions, and who controls projection?"
proposed_publication_date: "2026-03-13"
schedule_note: "Planning date requested for March–July 2026; not a publication record"
status: "draft — source reviewed; recorded recognition walkthrough and visuals pending"
reviewed_on: "2026-10-10"
task_ids: [scripture.catch-and-project, scripture.recent-speech-search, scripture.phrase-topic-search, preacher.review-recognition]
---

# How Trilorah recognizes scripture during a sermon

Trilorah listens to speech, looks for evidence of a Bible passage, and prepares a suggestion the operator can inspect. A spoken reference and a quotation give it different kinds of evidence.

The boundary is simple: in the current implementation, a recognized passage reaches the live screen only through an explicit operator or remote action. Speech alone does not project it.

## When the preacher says the reference

“John chapter three, verse sixteen” contains a book, chapter, and verse. Trilorah uses the transcribed words to resolve that reference and check the passage.

This still depends on what the speech engine heard. A book name can be misheard, a number can be unclear, or the preacher can pause before finishing the reference. Mentioning a person named John is not the same as asking the congregation to read John's Gospel.

Trilorah checks context and filters some weak or ambiguous detections. Those checks help it decide what to suggest; they do not guarantee that every reference will be caught.

## When the preacher quotes the passage

A preacher may quote a verse without naming its address. Trilorah can compare recognizable wording with indexed scripture and look for supporting matches.

For example, a quotation beginning “For God so loved the world” gives a different clue from the words “John three sixteen.” A distinctive quotation may support a candidate. A brief phrase shared by many passages may be too weak to identify one confidently.

The current quotation matching includes KJV and BSB wording. That does not imply equal recognition accuracy for every translation, paraphrase, language, or delivery style. The Bible selected for display and the wording available to quotation matching are related but different concerns.

## What the operator does

Read the caught reference and the prepared text. Check the translation and the part of the passage the preacher is using. Then use the explicit live control when the congregation should see it.

If the suggestion is wrong, do not send it. You can look up a known reference yourself or use the scripture search for a remembered phrase, person, event, or topic.

The **find scripture** action can also search recent speech. It is a recent listening window, not a search through an unlimited recording of the whole sermon. If the relevant words are no longer available, type what you remember.

## A realistic moment in a service

The preacher says, “Let's turn to John chapter three, verse sixteen,” then begins reading. A volunteer sees a John 3:16 candidate, checks the displayed translation, and sends it live.

A few minutes later, the preacher alludes to another passage without quoting enough distinctive wording. No useful catch appears. The volunteer types the remembered phrase into scripture search, reviews the possible matches, and chooses whether one belongs on screen.

Both moments are normal. A useful recognition workflow includes a clear way to review and a familiar manual fallback.

## Is there a setting for automatic projection?

Automatic scripture projection is blocked in the current runtime. A confidence score, a readiness label, a completed sound check, or a setting that mentions automatic behavior does not remove the operator-press requirement.

Audio quality, speech transcription, incomplete references, paraphrases, and unavailable Bible text can all limit a result. Rehearse with the real speaker and audio chain, then use recognition as help for the operator's next decision.

Continue with [searching for a passage when you remember the words](09-find-scripture-from-a-phrase.md) or [reviewing recognition after a service](15-preacher-sound-check-and-review.md).
