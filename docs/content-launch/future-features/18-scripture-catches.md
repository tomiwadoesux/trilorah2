---
id: "18"
title: "The verse wasn't on the service plan."
slug: "introducing-scripture-catches"
subtitle: "Scripture suggestions for the passages that come up during the sermon."
audience: "Volunteers following a sermon and teams evaluating recognition"
status: "draft — ready for copy review; release verification pending"
reviewed_on: "2026-10-11"
publication_date: null
publish_trigger: "Recorded reference and quotation demonstrations pass the release review."
source_paths: [electron/main.ts, electron/engine/verseDelivery.ts, electron/engine/quoteMatcher.ts, src/design/screens/ScriptureCatches.tsx]
release_gate: "Record reference and quotation examples, verify the manual-only publication boundary, and show an honest fallback."
evidence: "evidence.md#2-scripture-catches-with-operator-control"
visuals: "README.md#components-and-visuals"
---

# The verse wasn't on the service plan.

You've prepared the opening reading. Halfway through the sermon, the preacher names another passage. You need the reference, the right translation, and a moment to check the words before putting them up.

Trilorah listens for scripture in the speech it receives and prepares suggestions for the operator to review. Those suggestions are called catches. A catch gives you a passage to inspect while you follow what is being said.

## Two ways a passage can turn up

A spoken reference supplies an address: “John chapter three, verse sixteen.” Trilorah looks for the book, chapter, and verse in the transcribed words and checks the passage.

A quotation supplies the words themselves. “For God so loved the world” gives it something to compare with indexed scripture, even without the reference. The current quotation index includes KJV and BSB wording. A short shared phrase, a loose paraphrase, or different wording may not produce a useful match.

The result still depends on the audio and transcription. If the microphone feed is missing, the book name is misheard, or the sentence is incomplete, recognition can miss the passage or suggest the wrong one.

## You make the screen decision

For example, the preacher names John 3:16 and starts reading. A catch appears. You check its reference, text, and translation, then send it live when it belongs on screen.

Later, the preacher mentions a Bible story without enough detail to identify a verse. You can search the words you remember and assess the results yourself. A missing catch is a reason to use another route, not to put up the nearest guess.

**A recognized reference or quotation does not go live automatically in the current version.** The operator or paired remote must explicitly publish the suggested passage. A confidence label or completed sound check doesn't change that rule. Configured voice commands are a separate control; review those settings with the team before the service.

Try a rehearsal with a named reference and a quotation, then check what Trilorah actually heard. [See how scripture recognition works](../articles/04-how-scripture-recognition-works.md), including the review controls and the [phrase-search fallback](../articles/09-find-scripture-from-a-phrase.md).
