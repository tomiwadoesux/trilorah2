---
title: "Meet Trilorah"
status: "draft — hold until release availability, destination links and demonstration are verified"
reviewed_on: "2026-10-17"
audience: "Church volunteers preparing and running services"
---

# Meet Trilorah

The person running the screen is already doing enough.

Trilorah brings songs, scripture, slides, media and the order of service into one workspace. Prepare what you need, check the next item and choose when to put it in front of the room.

## It started at the operators’ desk

When Ayotomiwa Durojaye joined the operators as a first-time volunteer, one person was queuing verses, working out which passage the preacher was quoting without a reference, and putting songs together on the spot.

That was the starting point for Trilorah. We wanted to build technology around the person trying to keep up with all of it.

## Prepare a service you can follow

Build a run of show with sections for the service. Add the songs, scripture, slides and media you need, with notes for the operator alongside them. Open the actual content and check it before the service begins.

During the service, preview gives you somewhere to inspect the next item while the current one stays live. Explicit live controls and some shortcuts send content straight to the outputs, so those belong in rehearsal too.

## Find scripture from what is being said

With a working audio input and speech engine, Trilorah can suggest passages from spoken references and recognisable quotations.

The preacher might say “John chapter three, verse sixteen,” or quote a familiar passage without naming it. Trilorah can use those words to help find a match. You check the suggestion and choose whether to send it live. Unclear audio, paraphrases and ambiguous wording can produce a missed or wrong suggestion; manual scripture lookup remains available.

For an ongoing reading, **Auto advance** is a separate option that follows speech through scripture already live and can move to the next verse in that chapter. It is disabled each time you launch Trilorah. A newly caught reference does not turn it on or send itself live.

## Begin with a rehearsal

Give Trilorah a small service first: a welcome slide, one song, a Bible passage and a closing slide. Check the physical display, practise the transitions and save the service.

The [first-service guide](../../community/GETTING-STARTED.md) is the place to start. For the reason behind the product, read [why Trilorah started](../stories/23-why-i-started-trilorah.md).

---

## Internal launch notes — do not render

- This is launch-announcement copy, not evidence that a launch has happened. Keep the public date unset until there is an actual publication date. Earlier March–July planning dates are not publication history.
- Publish only after exercising the intended installer, the matching demonstration and its prerequisites. [Download configuration](../../../web/src/app/download/release.ts) currently points to v0.4.8, with Apple silicon Mac and Windows x64 installers; neither installer was installed or exercised for this draft. Do not add “available now”, download/platform promises or a release-version heading before verification.
- If new working-tree behaviour is absent from the release being announced, remove it from this announcement or wait for the relevant release. Do not advertise a development screenshot as a released feature.
- The broad first release announcement deliberately has one beginner action. Mobile controls, Messenger, programme import and congregation features have separate existing feature drafts; they do not all need to be squeezed into this post.
- Required visuals: one real rehearsal workspace image; the [short demo](DEMO-SCRIPT.draft.md); a legible crop of a scripture suggestion with its reference, text and **live** control. Caption test content as rehearsal material. No fabricated recognition result, customer quotation, percentage or time-saving claim.
- Founder evidence: [source notes](../stories/editorial-notes.md). Run evidence: [RunRail.tsx](../../../src/design/screens/run/RunRail.tsx), [RunContentPicker.tsx](../../../src/design/screens/run/RunContentPicker.tsx). Catch evidence: [CatchesPane.tsx](../../../src/design/screens/CatchesPane.tsx), [verseDelivery.ts](../../../electron/engine/verseDelivery.ts). Automatic reading evidence: [AutoAdvance.tsx](../../../src/design/screens/AutoAdvance.tsx), [autoAdvanceStore.ts](../../../src/stores/autoAdvanceStore.ts). These were source-reviewed on October 17, 2026, not demonstrated in a release.
- Recognition requires a prepared speech engine and usable audio; choosing local speech is not a promise that every other feature or cloud setup stays local. The announcement makes no whole-product offline/privacy claim. Link the final data-handling explanation from setup documentation.
- Replace draft guide/story links with implemented public routes. Add a download action only after installer access, any applicable access terms and the download destination are confirmed. Paid services remain deferred.
- If the publication includes a source-availability badge, use “Source-available” and link the actual [licence](../../../LICENSE). The current PolyForm Perimeter 1.0.1 permits church use and internal customisation, while restricting competing offerings, including free ones. Do not label the current covered source unrestricted open source.
