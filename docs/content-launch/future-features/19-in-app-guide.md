---
id: "19"
title: "Why Trilorah teaches one task at a time"
slug: "introducing-the-in-app-guide"
subtitle: "The thinking behind our progressive onboarding and the Messenger that guides it."
audience: "People learning Trilorah and leaders introducing it to their teams"
status: "draft — ready for copy review; release verification pending"
reviewed_on: "2026-10-30"
publication_date: null
publish_trigger: "Supported guide walkthroughs and setup recovery pass the release review."
source_paths: [src/App.tsx, src/components/ProductGuide.tsx, src/components/useGuideCursor.ts, src/lib/productGuide.ts, src/lib/guideWalkthroughs.ts, src/lib/guidePrerequisites.ts, src/lib/messengerProgress.ts, scripts/guideIndex.ts]
release_gate: "Verify supported walkthroughs, user takeover, reduced motion, and a real missing-key setup/search/recovery path."
evidence: "evidence.md#3-in-app-guide"
visuals: "README.md#components-and-visuals"
---

# Why Trilorah teaches one task at a time

“Open Settings” is a perfectly clear instruction once you know where Settings is.

You have a service to prepare. That might mean connecting a microphone, finding a passage or getting a song ready for the room. Learning Trilorah is part of that work, and we want the help to stay close to it.

We use a progressive approach to onboarding: learn a useful task, try it in the app, then come back for the next one. The Messenger delivers that guidance through short, interactive walkthroughs.

## Start with the job you need to do

Someone preparing lyrics needs different help from someone connecting a projector. We organise the guide around those jobs, with suggestions related to the part of the app you're using and a search for the task you have in mind.

You can open **i guide** at the top right and type an ordinary request such as “connect my microphone.” Search matches it to the supported guides and tolerates some spelling mistakes. You choose a result before anything happens.

Our aim is to make the next useful action easier to find. The rest of the workspace stays available while you learn.

## Choose how much help you want

For supported walkthroughs, the Messenger offers two choices:

- **Show me:** demonstrate an approved click or enter the words you supply into a supported field.
- **I'll do it:** point to the control and let you perform the step.

The triangle moves to the control, highlights it and places a short explanation nearby. It is a pointer inside Trilorah; your own mouse remains yours. Take over during a demonstration and the guide can pause while you work.

Real walkthroughs pause for the next action or choice. Optional spoken prompts can accompany the text when listening is inactive. If you prefer reduced motion, the pointer skips its travel animation.

## Keep the task together when setup is missing

Suppose you want an online image of mountains at sunrise. You open the image guide and supply those search words. This computer has no configured Pixabay or Pexels key, so the guide takes a setup detour.

It can point you to the relevant settings while keeping your search words ready. You enter and save the key yourself. Once the setup check finds provider access available, you can return to the task and continue.

A saved key still needs to work with its provider. If the search fails or returns no results, the guide can surface that state and help you return to the search words. When images arrive, you choose the one you want. Selecting the image in this workflow downloads it for preview; it does not project it.

That continuity matters to us. The person who asked for an image should be able to finish that job after dealing with its setup.

## Remember completed guides

Finishing a guide records its completion on the current computer or browser profile. That history helps prioritise unfinished tasks when you next open the Messenger. Completed topics remain available to revisit.

This memory is local. It does not follow your account to another computer, and clearing the stored app or browser data can reset it. Completing a guide also isn't a test of whether someone can run a whole service; rehearsal still matters.

## Keep consequential actions with the operator

The Messenger has limits on what it can demonstrate. It can open approved controls and fill supported text fields. Actions such as starting real listening, sending content live, approving a remote device or deleting material require your own action. Provider secrets are yours to enter too.

While real listening is active, the guide uses pointing and text rather than demonstrated clicks or typing, and its spoken prompts stay silent. Help should leave you in control of the service.

## Maintain the guide with the product

Each supported walkthrough connects written steps to named controls in the interface. That is how the pointer knows where to go. Search finds an existing task; it does not invent a sequence of clicks from your request.

The control index is rebuilt with the app, and development checks help identify changes that can affect lessons. New features still need someone to write and review their instructions. Some topics currently have a full walkthrough; others offer directions or quick steps.

A rehearsal gives your team room to learn the controls and check the setup. Start with one task in an empty room, then try the next one yourself. The [service rehearsal guide](../articles/14-train-a-new-volunteer.md) brings those small jobs together.
