# Trilorah product marketing context

Read this when writing or changing Trilorah's website, interface, guides, emails or marketing. Write the copy needed for the page or flow being built, using the references below. The founder does not need to commission a complete manuscript for every page first.

## Audience and purpose

Trilorah builds technology for churches. The current product helps church volunteers prepare and run services, with songs, scripture, slides, media and the service order in one workspace. Team leaders also need to evaluate setup requirements, train volunteers and hand preparation to the next operator.

Explain intelligent behaviour through an actual task and its conditions. The founder wants the ambition of a technology brand; keep the founder's chosen positioning when supplied. Headlines proposed in conversations are not automatically approved brand slogans. Distinguish a future ambition from a current capability.

The founder's starting experience was joining the operators as a first-time volunteer and seeing the pressure on the person queuing verses, identifying quoted scripture without a reference and making songs on the spot. The [founder story and source notes](../docs/content-launch/stories/editorial-notes.md) hold this account. Do not add an incident, church, fourth task, result or personal history.

## Source licence and optional paid services

The founder's latest instruction returns to **PolyForm Perimeter License 1.0.1**, applied in the root [LICENSE](../LICENSE), with [NOTICE](../NOTICE) naming Ayotomiwa Durojaye for original Trilorah source. This supersedes the intervening Apache-2.0 choice for the current covered source. Explain that church use and internal customisation are permitted, while providing a competing product is restricted, even if it is free. Do not promise unrestricted public competing forks. Describe the current licence as **source-available**, rather than standard open source.

Changing the current licence does not revoke valid licences already granted for earlier copies. Preserve applicable earlier terms and third-party rights. Do not infer that a previous distribution occurred solely because a licence was changed locally. Package metadata uses `SEE LICENSE IN LICENSE`, because Perimeter 1.0.1 has no current SPDX identifier.

The exact paid deliverables, prices, billing model and usage limits remain undecided. The founder explicitly deferred that commercial-planning decision until later; do not block unrelated writing on it or repeatedly ask for a plan choice. Revisit when the founder resumes commercial planning or the task requires actual billing or paid-service terms.

Describe paid value through concrete work handled for the church: possible examples are setup, managed cloud or AI services, provider billing and support. Confirm the chosen services before promising them. Technical knowledge is not the price boundary: do not market the paid option as a fee for churches that do not understand open source. Keep the community path understandable for volunteers, too.

Use the actual source licence when explaining rights. It does not establish that provider usage, hosting or support is free. Distinguish the source licence, desktop distribution, any self-managed services and the services Trilorah operates. Do not call this an open-core product or promise a hosted offering merely from the Supabase analogy.

The [licensing scope](../docs/legal/LICENSING.md) records the applied licence and third-party boundaries. Original code, third-party code/content and the Trilorah name/marks have distinct rights; do not describe every bundled asset or provider API as Perimeter-licensed. The operator name supplied for the Privacy Policy is **Ayotomiwa Durojaye**. Source licence application does not certify ownership or redistribution rights for every third-party file, service or Bible translation.

## Shared references

| Need | Read |
| --- | --- |
| Voice, humour, writing examples and component choices | [TONE.md](../docs/content-launch/TONE.md) |
| What each website page should answer and how to write it while coding | [Website writing briefs](../docs/content-launch/WEBSITE-WRITING.md) |
| Existing long articles and the publishing plan | [Content library](../docs/content-launch/README.md) |
| Current task records, prerequisites, lessons and evidence paths | [Product map](../docs/product-guide/product-map.json) and [maintenance instructions](../docs/product-guide/README.md) |
| Desktop and site visual references, current palette and typography sources | [Brand workspace](../src/brand-system/README.md); inspect the relevant existing page's components and styles |
| Legal facts and unresolved policy decisions | [Legal drafting brief](../docs/content-launch/LEGAL-BRIEF.md) |
| Current policy draft, applied source licence and publication dependencies | [Legal and launch documentation](../docs/legal/README.md) |
| Beginner installation, rehearsal and developer setup | [Community docs](../docs/community/README.md) |
| Contact copy and internal request handling | [Support draft](../docs/support/SUPPORT-PAGE.draft.md) and [operations](../docs/support/OPERATIONS.md) |

## The voice in practice

Speak as “we” for the brand and “you” for the reader. The identified in-app Messenger can use “I”. Be direct, comfortable with an opinion and occasionally cheeky, with the joke delivered straight. A short parenthetical aside can add a second beat. Most instructions need none.

The founder liked “Your phone has been promoted” and the idea of “you should thank me”. They rejected “Sunday has declined to move” and “The preacher has taken a detour” as artificial attempts at humour. Use the full tone guide for examples and context; do not repeat one joke across the website.

Keep action labels, troubleshooting, permissions, billing and legal text plain. Use the existing design components and adapt the amount of copy to the actual layout. Choose screenshots, recordings, lists or diagrams when they help the reader complete the task.

## Evidence before claims

Use the product map to find the relevant implementation, then inspect current code and the actual UI when needed. Note whether evidence is source-reviewed, demonstrated or verified in the intended release. A screenshot, development fixture or working-tree implementation does not establish public availability.

One distinction checked on October 17, 2026: a newly caught spoken reference or quotation is not automatically sent live by the catch delivery gate. Separately, opt-in **Auto advance** can follow reading through scripture already live, including moving to the next verse in the same chapter. See `electron/engine/verseDelivery.ts`, `src/design/screens/AutoAdvance.tsx`, `src/lib/readAlong.ts` and `src/stores/autoAdvanceStore.ts`. Recheck these paths when writing about automatic projection. Broad older wording such as “scripture can never change automatically” is inaccurate.

Confirm pricing, platforms, licensing, provider costs, support commitments and data handling before writing them as facts. Do not infer a shipped feature from a navigation card. Do not invent testimonials, customer numbers, time savings, recognition accuracy or security certifications.

When a necessary fact is missing, continue with the supported parts and record the specific open decision in the page brief. Ask the founder for business choices; inspect the product for implementation facts. Keep internal placeholders and evidence notes out of rendered public copy.

## Keep the sources connected

The website's `/guide` currently imports lesson text from the product map through `web/src/app/guide/lessons.ts`. The Messenger uses the same map. Edit those shared lesson records for short walkthrough changes instead of authoring a second set of steps in a page component.

The articles under `docs/content-launch` are Markdown drafts. They are not automatically rendered by `/guide` or published as blog posts. Connecting them to a website route requires implementation.

When changing a workflow, update the affected map record, guide or article and its reviewed evidence. Follow the map's change-check process; do not refresh snapshots merely to conceal drift. Maintain this context when the audience or agreed positioning changes, and update TONE.md when the founder changes the voice.
