# Trilorah website writing briefs

Use these briefs to write website copy while implementing each page. Load [product context](../../.agents/product-marketing.md) and the [voice guide](TONE.md) first. A brief supplies the page's purpose, required facts and next action; the coding agent can choose the wording and suitable existing components as the page takes shape.

## A brief for each page

Keep this information beside the implementation task, or add a focused brief here when it is needed:

```text
Page and route:
Reader and situation:
Main question to answer:
Primary next action:
Required facts, conditions and evidence paths:
Sections needed to answer the question:
Useful screenshot, recording, table or example:
Open business or release decisions:
Related guide or page:
Reviewed version/date and publication state:
```

These are editorial fields, not a required public layout. Write concise final copy directly into the implementation when that is the task. Reuse existing content when it answers the same question. Keep claims and conditions together and record unsupported facts as open decisions.

## Main website pages

| Page | Reader's job | Essential content | Useful next action |
| --- | --- | --- | --- |
| Homepage | Understand the product and decide whether to explore | Clear positioning; a concrete demonstration; a few meaningful capabilities with their requirements; a brief FAQ | Watch the demonstration or download an available release |
| Product sections or pages | Understand one capability and how it helps | A real scenario; demonstrated behaviour; setup conditions; control boundaries; a link to instructions | Follow the relevant guide or see the feature demonstrated |
| Downloads | Install the right release and begin | Available installers, verified platform requirements, version, applicable cost/access terms, installation help and a first-use link | Download and complete a rehearsal |
| Community and paid services | Choose the preferred setup and understand total costs | PolyForm Perimeter 1.0.1 code rights and competition restriction; the self-managed setup; exact optional paid services, usage limits, external charges and billing rules | Download or follow the actual service/signup flow |
| About | Understand why this exists and who is building it | Founder account, present purpose, real team details and contact | Explore the product or get in touch |
| FAQ | Resolve a decision or setup uncertainty | Direct answers about requirements, imports, recognition, operator control, phone access, cost and data handling | Open the specific guide or contact support |
| Support | Get the next useful action when stuck | Help search or guide links, contact route, useful diagnostic details and realistic response expectations | Complete a check or send a support request |
| What's new | Understand an actual release | Date and version, useful additions/fixes, availability and any user action | Update or read the affected guide |
| Blog | Understand a story, feature or product decision | Selected existing drafts, actual demonstrations and current guide links | Try the relevant workflow |
| Privacy, service terms and source licence | Understand data practices, the service agreement and software rights | Verified practices; actual optional paid-service terms; the chosen source licence; see the [legal brief](LEGAL-BRIEF.md) | Find the relevant policy, licence or contact |

Product sections do not each need their own route at launch. Use a separate page when there is enough distinct information to help the reader. A footer's destination must lead to a real page or contact flow before inviting public users through it.

## User documentation

Treat documentation as a maintained part of the product. Start with this reading path:

1. **Getting started:** install, prepare a small service, connect a display, rehearse, save. Reuse [the first-service draft](articles/02-first-service-checklist.md) after checking the current workflow.
2. **Task guides:** microphone and transcription; screens; scripture search and recognition; songs; media and slides; service planning; save/transfer; phone pairing and controls.
3. **Troubleshooting:** no audio, audio but no transcription, no suitable scripture suggestion, display problems, connection loss and failed imports. Use observable checks and recovery actions.
4. **Reference:** verified requirements, supported file formats, translations/languages, online/offline boundaries, provider/API setup, shortcuts and the difference between preview, live, catches, voice commands and Auto advance.

Desktop translation evidence: the Bible builder downloads complete NKJV and NLT (1996) into `bible.db`. Installed copies are read locally without chapter expiry; additional YouVersion translations still use online chapter loading. Confirm the release database contains both before claiming they are included in an installer. Sources: `scripts/lib/sabda-bible.ts`, `scripts/build-bible-db.mjs`, `shared/downloadedBibles.ts`, `electron/main.ts`.

The founder's latest instruction returns to PolyForm Perimeter 1.0.1 for current covered original Trilorah source code, replacing the intervening Apache-2.0 choice without revoking valid earlier grants. Describe the current licence as source-available. It permits church use and internal customisation, while restricting providing competing products, including free offerings. Do not promise unrestricted public competing forks. An optional Trilorah-operated paid service remains undecided. Include a community installation/configuration route, and self-hosting instructions only for services actually supported for self-management. Add contributor setup and contribution instructions when the source is ready for public participation. Ordinary volunteers should still have clear installation help without having to become contributors.

The current website guide reads short lessons from [the product map](../product-guide/product-map.json) through [lessons.ts](../../web/src/app/guide/lessons.ts). Those lessons also serve the in-app Messenger. Keep short instructions there. Longer explanations and troubleshooting can reuse the existing [article drafts](README.md); connecting Markdown articles to public website routes is separate implementation work.

When a control, prerequisite, result or limit changes, update the affected shared lesson and long guide in the same product change. Check screenshots against the release being documented. A source index can flag changed code; it cannot decide new instructions or certify hardware behaviour.

## Work to write first

| Order | Deliverable | What can be done now | What still needs confirmation |
| --- | --- | --- | --- |
| 1 | Shared agent context and brief pattern | Product context, tone links, evidence rules and this page plan | Maintain these as the product and brand change |
| 2 | Applied source licence, legal facts record, then privacy and service terms drafts | Preserve LICENSE/NOTICE; use the supplied operator name and [legal brief](LEGAL-BRIEF.md); inspect active data flows and draft supported sections | Third-party release scope, contact activation and release practices; paid-service terms remain deferred |
| 3 | Getting started and requirements | Adapt existing guides to the current app; create one clear beginner route | Release/platform/hardware/provider checks |
| 4 | Support and data-request instructions | Write a useful contact page and reusable replies from the real request process | Active inboxes, who responds and how data requests are handled |
| 5 | Welcome and first-use messages | Guide people to installation, one rehearsal and help | Actual signup/onboarding flow and delivery setup |
| 6 | First release note and launch announcement | Use verified shipped behaviour and the founder story | Real release date, availability and demonstration |

Write homepage, feature-section and FAQ copy as those pages are implemented from the briefs above. The existing 23 article drafts already provide a substantial queue; keep reviewing and integrating those rather than commissioning another complete library now.

## A useful implementation request

“Build the mobile-control product section. Follow AGENTS.md, the product marketing context and TONE.md. Inspect current pairing and remote behaviour, explain the desktop/network requirements, write concise copy that fits the existing design, and link to the pairing guide. Keep unresolved release facts in the brief.”

This gives the coding agent enough direction to write responsibly while building. The same pattern works for a download page, settings flow, help article or onboarding email.

## Congregation and operator phone experiences · October 17, 2026

The current working tree separates /home#companion (reading and personal study) from /home#remote (paired presentation control). Do not use an operator remote screenshot as the congregation companion. The companion section uses captures from /live/preview, with sample content identified.

Supported companion copy: read along word by word; open WEB passages and chapters; keep personal notes and saved verses on the device; search and download the published transcript; revisit public services. Explain device storage beside saving claims. Do not promise account sync, a complete offline app, an audio recording, or the projector's Bible translation in the reader.

Follow along is a live reading surface: the highlight runs about five seconds behind speech so already-received words can appear ahead at lower opacity. Its controls are Hold reading, Back to live and timing adjustment. Avoid music-player controls or playback-speed copy. Ended services are reading documents. The preview now delivers sample phrases continuously and must stay labelled as a demo.

The desktop Companion and Giving fields now persist and queue relevant public changes. Confirm authenticated delivery in the release before treating a local save as proof that a phone received it. The public congregation link has no Wi-Fi-only access restriction. Pairing/approval belongs to the operator remote. These are working-tree changes, not a published release announcement.


## Scripture workspace · October 18, 2026

Audience: the operator following a live reading. Lead with keeping the current passage clear and having the next reference ready. Use the labels **find reference**, **Auto advance**, **Saved**, **clear**, and **restore**.

The current working tree replaces History with individual recent-reference tabs, × dismissal, save icons and +N overflow. Save keeps a local bookmark and queues the reference in the current service. Removing a tab does not delete its bookmark. Document .tri saving separately from local bookmarks.

Explain the distinction between catching a new passage and following an already-live reading: new catches require an explicit send; Auto advance can follow a full reading and pauses during detected prayer. Prayer detection uses configured phrases, not general understanding of every prayer. Do not promise perfect transcription or recognition.

Theme exploration remains in preview until its Go live action; ordinary scripture sends retain the current live theme. Short ranges stay together, longer ranges page through whole verses. Clear and Restore retain the current page. Focus and Settle are the exposed text transitions. Surrounding panel gradients sample image colors and drift with CSS; do not claim measured low-power performance until tested on release hardware.

Evidence: local desktop checks for ranges, page controls, clear/restore and theme isolation; resolver, navigation, loading and duplicate-suppression tests. Microphone-to-projector rehearsal and release availability remain unverified. These are working-tree updates, not a release announcement.
