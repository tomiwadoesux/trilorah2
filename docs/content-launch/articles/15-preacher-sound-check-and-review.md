---
title: "Use a preacher sound check and review missed scripture"
slug: "preacher-sound-check-and-review"
audience: "Operators improving recognition with a regular preacher"
question: "How do sound checks, corrections, and teaching help without promising perfect recognition?"
proposed_publication_date: "2026-07-17"
schedule_note: "Planning date requested for March–July 2026; not a publication record"
status: "draft — source reviewed; sound-check and correction workflow verification pending"
reviewed_on: "2026-10-10"
task_ids: [preacher.create-select, preacher.sound-check, preacher.review-recognition, preacher.teach-vocabulary]
---

# Use a preacher sound check and review missed scripture

A repeated mistake gives an operator something concrete to investigate. Perhaps a book name is consistently transcribed incorrectly, or a spoken reference is caught as a different passage.

Trilorah's preacher profiles include sound checks, recognition review, and teaching controls. Use them to record and examine specific examples. They do not guarantee that future speech will be recognized perfectly.

## Select the right preacher

Open the preacher profile area, choose the person you are working with, and use **set for today** when appropriate. Add a profile if the speaker does not yet have one.

Check the name before adding teaching or reviewing examples. Useful feedback belongs with the speaker whose delivery and recurring wording you are checking.

A preacher profile is not an acoustic voice clone. The controls here support recognition examples, vocabulary, and reference handling.

## Run a sound check with the service microphone

Open **sound check & review** and use the offered reference exercises. Start the sound check, have the preacher speak an exercise naturally, and wait for the result before moving on.

The sound check uses a local speech engine, even if regular services are configured with a different speech provider. First use may require the local engine and model to download. Results arrive in chunks with processing time, rather than appearing instantaneously after each word.

Use the microphone and feed you intend to use for the service. A successful laptop-microphone check does not certify a separate soundboard feed.

Stop the check when finished. Treat the result as evidence about those examples under those conditions.

## Review the actual recognition example

Recognition review offers choices such as **Correct**, **Wrong reference**, **Not a reference**, and **Can't tell / new passage**.

Choose the answer the evidence supports. If the proposed passage was wrong, enter the correct Bible reference and use **Save correction**. If there is not enough context to know, use the uncertain option rather than guessing.

Only verified answers affect readiness. Unreviewed or skipped examples do not add an accuracy score, and an empty review list does not prove that no reference was missed.

Use **Add missed example** when you can supply words from a missed reference. A specific example is more useful than a general impression that recognition struggled.

## Choose the teaching control that fits

The teaching area separates three kinds of help:

- **Sounds like** maps a recurring mistaken form of a Bible book name to its intended meaning.
- **Vocabulary** supplies familiar words or names as speech-recognition hints.
- **Ignored tails** handles habitual words that follow a reference and should not be treated as part of it.

Use a narrow example and check it again afterward. Adding every unusual word to every list makes the reason for each entry harder to understand.

The teaching controls require the profile to be connected to the app's engine. Saving an entry confirms the setting, not the success of the next recognition attempt.

## Keep the operator in the loop

A higher readiness indicator does not enable automatic scripture projection in the current implementation. The operator still reviews and explicitly sends the passage live.

Use sound checks before a service and careful review afterward to build a clearer understanding of what the system heard and where it needs help.

For recognition fundamentals, read [how scripture recognition works](04-how-scripture-recognition-works.md). For a missing audio signal, start with [the three-stage troubleshooting guide](13-when-trilorah-cannot-hear-you.md).
