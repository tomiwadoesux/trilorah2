---
id: "21"
title: "Tell Trilorah what it got wrong."
slug: "introducing-preacher-corrections"
subtitle: "Keep verified recognition feedback with the preacher it belongs to."
audience: "Operators who work with a regular preacher"
status: "draft — ready for copy review; release verification pending"
reviewed_on: "2026-10-11"
publication_date: null
publish_trigger: "A verified correction, replay, and local sound check pass release review."
source_paths: [src/design/screens/dashboard/ProfileView.tsx, src/design/screens/dashboard/LearningActions.tsx, src/design/screens/dashboard/Teaching.tsx, electron/main.ts, shared/preacherLearning.ts]
release_gate: "Verify profile selection, a saved correction and replay, sound-check setup, and provider/settings distinctions."
evidence: "evidence.md#5-preacher-specific-corrections"
visuals: "README.md#components-and-visuals"
---

# Tell Trilorah what it got wrong.

When a scripture suggestion is wrong, “that wasn't right” is a fair response. A specific correction gives Trilorah more to work with.

Preacher profiles let you review recognition examples, record missed references, and teach recurring wording. The feedback stays with the selected preacher, so check who you're working with before saving it.

## Correct the example you can verify

Suppose you can hear the preacher saying “Romans chapter eight, verse one,” but the transcript repeatedly mishears the book name. A book-name correction can connect that heard wording with Romans when it appears in a reference-like phrase.

Recognition review also lets you confirm a correct result, supply the right reference, mark something as ordinary speech, or say you can't tell. Missed references can be recorded separately.

Only verified answers affect readiness. An empty review list doesn't show that every reference was caught, and an uncertain example doesn't need a confident answer just to clear it.

## Three places to add useful detail

| What you noticed | Teaching control |
| --- | --- |
| A book name keeps appearing as the same wrong words. | **sounds like:** connect the heard form with the intended Bible book. |
| A familiar name or church term needs help. | **their words:** add it for supported transcript matching and speech hints. |
| A habitual phrase follows a reference and gets included in it. | **ignored after a verse:** identify the words to leave out of that reference ending. |

Add a narrow example, save it, and test it again. The result depends on the active profile, settings, and speech path. Saving feedback alone doesn't prove the next attempt will be correct.

The sound check gives you reference exercises to try. It uses local speech recognition, which may need a first-time model download; your regular service may use a different provider. Check the actual service microphone and feed too.

These controls support reviewed corrections and targeted teaching. They don't create a voice clone or enable automatic scripture projection. You still choose what goes live.

Start with one recurring mistake you can verify. [Run a sound check and review an example](../articles/15-preacher-sound-check-and-review.md), then compare the next result.
