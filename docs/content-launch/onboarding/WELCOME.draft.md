---
title: "Welcome and first-use copy"
status: "draft — proposed messages; no delivery or first-run triggers implemented by this document"
reviewed_on: "2026-10-17"
audience: "A volunteer opening Trilorah for the first time"
---

# Welcome and first-use messages

## First welcome

**Title:** Welcome to Trilorah.

**Body:** Start with a small service and an empty room. A welcome slide, one song and a Bible passage will do.

**Primary action:** Start a rehearsal

**Secondary action:** Explore the workspace

## Rehearsal introduction

**Title:** Get the basics under your fingers.

**Body:** Prepare a short run, check the screen and practise the transitions. Then save the service so you can open it again.

**Readiness list:**

- Add your practice content to the run of show.
- Check what appears on the physical display.
- Practise sending content live and taking it down.
- Save a `.tri` service file and reopen it.

**Action:** Open the rehearsal guide

## Finding help in the app

**Title:** Need to find something?

**Body:** Open the Messenger and search for the task, such as “connect a microphone” or “set up a screen.” Choose a matching guide to see the next step.

**Action:** Open Messenger

## Before the first listening test

**Title:** Check the input. Then say something new.

**Body:** Choose your microphone or soundboard feed in Audio. Press Start listening and say a short test sentence. Look for an audio level and new words in the transcript.

**Sharing notice:** If cloud is configured and you’re signed in, starting listening can open a public service and publish its transcript. Check sharing before testing.

**Supporting link:** Check speech setup and data handling

## Optional welcome email

**Subject:** Your first service in Trilorah

**Preview text:** A small rehearsal is a good place to begin.

Welcome to Trilorah.

Start with a welcome slide, one song and a Bible passage. Arrange them in a short run of show, check the connected screen and practise the transitions before using Trilorah with the congregation.

The [first-service guide](../../community/GETTING-STARTED.md) walks you through setup, rehearsal and saving your work. It also explains which actions send content straight to the screen, so you can learn them while the room is empty. (A forgiving audience.)

When you need help finding a control, open the in-app Messenger and search for the task.

**Action:** Follow the first-service guide

— Trilorah

---

## Internal implementation notes — do not render or send

- These are copy options for the flow being implemented, not proof of an existing first-run tour, onboarding checklist or email service. Use only the messages that fit the actual flow. Do not add all five panels to the first launch.
- Prefer the short first welcome plus one useful next action. Keep the readiness list inside the guide rather than an extra blocking dialog. Preserve a working dismiss/explore path.
- “Start a rehearsal” and “Open the rehearsal guide” require a real supported destination. They must not silently start recording, enable cloud sharing, pair a phone or send anything live. Check the guide route and final control labels in the intended release.
- Show “Open Messenger” only when [ProductGuide.tsx](../../../src/components/ProductGuide.tsx) is mounted and usable. Current supported tasks and readiness checks live in [productGuide.ts](../../../src/lib/productGuide.ts), [guideWalkthroughs.ts](../../../src/lib/guideWalkthroughs.ts) and [guidePrerequisites.ts](../../../src/lib/guidePrerequisites.ts). Search matches supported lessons; this is not an unrestricted agent.
- The listening copy uses labels checked in [Live.tsx](../../../src/design/screens/Live.tsx). Link its supporting text to the completed audio/privacy explanation. Starting listening can initialise cloud service sharing in a configured, signed-in setup; do not imply that a microphone check stays entirely on the computer. Use rehearsal material and review the [privacy source evidence](../../legal/evidence-web-cloud.md) before implementing this prompt.
- The `.tri` rehearsal uses the current [TriPackageActions.tsx](../../../src/design/screens/run/TriPackageActions.tsx) flow. A save confirmation should appear only after a successful save result. This draft does not invent completion detection or claim that every setup requirement can be checked automatically.
- The email is optional editorial material. Sending it requires an actual welcome-email flow, appropriate recipient permission, an active sender/reply route and working public guide links. The founder has confirmed that the proposed support and privacy addresses are not active; do not use either as a working reply route. No message has been sent and no mailbox or sending system has been configured by this document.
- Do not add paid-plan, discount, trial-expiry or “all AI is included” copy. The paid offering is deferred.
- Check these instructions in the intended installer before publication. [GETTING-STARTED.md](../../community/GETTING-STARTED.md) records the current setup evidence and outstanding platform/provider walkthroughs.
