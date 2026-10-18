---
title: "About Trilorah"
status: "draft — founder framing and release review required before publication"
reviewed_on: "2026-10-17"
audience: "Church volunteers and leaders deciding who Trilorah is for"
---

# Built for the person running the screen

Someone has to find the verse, prepare the song and put the right words in front of the room. We build Trilorah for the person doing that work.

Trilorah brings songs, scripture, slides, media and the order of service into one workspace. You can prepare the material, check what comes next and choose when to show it. Listening can help find spoken Bible references and recognisable quotations during a sermon, with the suggestion available for you to review.

## Where it started

Ayotomiwa Durojaye joined the operators as a first-time volunteer and saw the pressure on the person running the screen. They were queuing verses, identifying passages from quotations without a reference, and putting songs together on the spot.

That experience became the starting point for Trilorah.

The operator already had plenty to follow. We wanted to build technology that could help with the work happening at that desk: preparing a service, finding scripture and getting the next item ready while the current one stays on screen.

## What we care about

Useful intelligence needs a clear job. In Trilorah, that might mean finding a passage from spoken words or helping a new volunteer locate a control. The result needs to be understandable, and the person using it needs to know what happens next.

That is why preparation, review and rehearsal belong alongside the features. A scripture suggestion needs checking. A saved service needs opening on the receiving computer. The projector needs checking from the room.

We’re building Trilorah around that kind of real use, with church volunteers at the centre of the decisions.

[Meet Trilorah](../articles/01-meet-trilorah.md) · [Try a first-service rehearsal](../../community/GETTING-STARTED.md)

---

## Internal production notes — do not render

- The founder account is supplied evidence. The broader purpose and “we” framing above are proposed brand copy, not a quotation or a claim about an established team. Ask the founder to review the framing alongside [the first-person story](../stories/23-why-i-started-trilorah.md) and [its source notes](../stories/editorial-notes.md).
- No founding year, customer count, church, dramatic incident, fourth operator task, measured result or legal company has been supplied. None is added here. Ayotomiwa Durojaye is the supplied founder/operator name; do not expand it into an incorporated company name.
- Scripture catch review was checked in [CatchesPane.tsx](../../../src/design/screens/CatchesPane.tsx) and [verseDelivery.ts](../../../electron/engine/verseDelivery.ts). A newly caught reference is not automatically promoted by the delivery gate. [Auto advance](../../../src/design/screens/AutoAdvance.tsx) is a separate opt-in behaviour for scripture already live; this page does not promise that every output change always needs a click.
- Preparation and item controls were checked in [RunRail.tsx](../../../src/design/screens/run/RunRail.tsx). Supported companion guidance was checked in [ProductGuide.tsx](../../../src/components/ProductGuide.tsx); do not expand the locating-control example into a claim that the Messenger can perform every task.
- Source review does not establish that the demonstrated behaviour is in the downloadable release. Verify the intended installer before publishing. The [download configuration](../../../web/src/app/download/release.ts) points to v0.4.8; assets have not been installed or exercised for this draft.
- Optional visual: a real founder portrait with permission, or one current workspace screenshot showing a prepared run and preview. Caption the latter “A rehearsal service in Trilorah.” Do not present a staged or generated scene as the founder’s first volunteer experience.
- Convert the two draft-document links to real public destinations during implementation. Add a contact action only after its destination works. This file does not create an About route.
