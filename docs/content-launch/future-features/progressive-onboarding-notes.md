# Progressive onboarding article facts and production notes

Internal companion to [article 19](19-in-app-guide.md). Source reviewed October 30, 2026. Keep this record, frontmatter and release checks out of reader-facing copy.

## The accurate angle

**Progressive, task-based onboarding delivered through contextual, interactive guides.** This describes introducing guidance around the job a person chooses and prioritising suggestions using local guide history. It is a design approach, not the name of an AI algorithm or a claim that the software independently learns the whole product.

The article explains the intended benefits: reduce the amount someone must learn before a useful task, keep a supported task together through setup, let people choose a demonstration or their own actions, and preserve operator control. These are design intentions. No measured training-time reduction, error reduction or user study has been supplied. The rationale is proposed brand wording for founder review, not a quotation from a retrospective interview.

The founder clarified on October 30 that general copy should address people leading and running church production, including heads of department. Use you/your team; being new to the software does not imply being new to production. The article's earlier volunteer-only framing has been removed.

[Nielsen Norman Group's explanation of progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) concerns deferring secondary options, and distinguishes that from a linear sequence of steps. It informs the terminology; it does not evaluate Trilorah. Avoid claiming that a guided sequence alone establishes progressive disclosure or that this is a newly invented 2026 technique. Trilorah's guides do not unlock app features as a reward for completion.

## Current implementation and boundaries

| Topic | Supported statement | Evidence |
| --- | --- | --- |
| Entry | The app opens into the workspace. People open the top-right guide themselves; no required first-run product wizard is mounted. | [App.tsx](../../../src/App.tsx), [ProductGuide.tsx](../../../src/components/ProductGuide.tsx), [Live.tsx](../../../src/design/screens/Live.tsx) |
| Suggestions | Candidate order uses recently introduced lessons, the last recognised interface area and incomplete starter tasks. Completed starter tasks can still appear as fallback results. | [ProductGuide.tsx](../../../src/components/ProductGuide.tsx), `fresh`, `nearby`, `results` |
| Request matching | Local exact/prefix/edit-distance matching ranks prepared task vocabulary and aliases. Choosing a result is separate from executing a step. | [productGuide.ts](../../../src/lib/productGuide.ts), `searchGuideTasks` |
| Demonstration | Approved clicks, focus and supplied-text entry use reviewed targets. Users can choose manual guidance instead. The triangle is rendered inside the app, not the OS mouse. | [guideWalkthroughs.ts](../../../src/lib/guideWalkthroughs.ts), [useGuideCursor.ts](../../../src/components/useGuideCursor.ts) |
| Target checks | The guide looks for visible controls, checks occlusion and current position, and can pause on takeover. Reduced motion removes animated travel. | [useGuideCursor.ts](../../../src/components/useGuideCursor.ts), [ProductGuide.tsx](../../../src/components/ProductGuide.tsx) |
| Prerequisites | Generic checks currently cover image-provider availability and Bible DB connectivity. Workflow-specific checks cover selected states such as external display presence and fresh microphone signal/transcript. This is not universal setup diagnosis. | [guidePrerequisites.ts](../../../src/lib/guidePrerequisites.ts), [ProductGuide.tsx](../../../src/components/ProductGuide.tsx) |
| Image example | Missing provider availability can open Settings, preserve words and return after setup. Users enter keys and select the image. Provider availability is not proof of successful authentication or search. | [ProductGuide.tsx](../../../src/components/ProductGuide.tsx), `openSetup`, `returnFromSetup`; [guideWalkthroughs.ts](../../../src/lib/guideWalkthroughs.ts) |
| Local progress | One `trilorah-messenger` localStorage key stores completion timestamps and seen map version. There is no church/account namespace or cross-device sync here, despite the source comment saying per church. | [messengerProgress.ts](../../../src/lib/messengerProgress.ts) |
| Completion | Microphone completion checks fresh audio and transcript. Other tasks can use UI signals or the user confirming continuation. Reaching the end of a guide does not certify service readiness. | [ProductGuide.tsx](../../../src/components/ProductGuide.tsx), [productGuide.ts](../../../src/lib/productGuide.ts) |
| Voice and rephrasing | Optional speech synthesis reads prompts. During real listening, guide speech is suppressed and demonstrations become point-only. Alternative wording comes from written variants. | [ProductGuide.tsx](../../../src/components/ProductGuide.tsx), [guideWalkthroughs.ts](../../../src/lib/guideWalkthroughs.ts) |
| Updates | Build/development indexing refreshes control metadata; the development update event pauses active guidance. New features and changed workflows need maintained lessons and completion rules. | [guideIndex.ts](../../../scripts/guideIndex.ts), [check-product-map.mjs](../../../scripts/check-product-map.mjs) |

The optional microphone demo is explicitly simulated and can advance automatically. Do not present it as proof of actual microphone setup. Other real walkthroughs stop at their questions or choices. The guide does not operate every mapped task; do not claim whole-app autonomous control, free-form AI conversation, generated rewrites or self-teaching after updates.

The separate [welcome/rehearsal messages](../onboarding/WELCOME.draft.md) remain draft copy. They are not evidence of a first-run flow or welcome email already being sent.

## Visuals that explain this article

1. **One captioned recording:** open the guide, choose a supported task, use Show me for a permitted action, switch to I'll do it, and take over to demonstrate pausing. Keep the target and bubble legible. Include a written equivalent below the recording.
2. **A three-image sequence:** the online-image task, the missing-provider setup detour, then the retained query and genuine results after setup. Never expose a real key. Caption the final state as preview, not a live projection.
3. **Optional compact flow diagram:** chosen task → supported step → user action or demonstration → next step. The missing-setup branch returns to the same task. A diagram explains sequence; it does not replace a real interaction recording.

Use a rehearsal workspace and real UI. Screenshots can locate a control but cannot establish cursor motion, successful recognition or an automatic completion check. No visuals have been produced by this article-writing pass.

## Release and publication checks

- The [download configuration](../../../web/src/app/download/release.ts) names v0.4.8. Opening its [GitHub release page](https://github.com/tomiwadoesux/trilorah2/releases/tag/v0.4.8) on October 30 returned a fetch/cache error in the browser tool. This does not prove the release absent or private. Its contents and public availability remain unverified by this pass.
- Verify the claimed guides in the intended installer, including missing-key setup and successful return, manual progression, takeover, existing-text preservation, reduced motion and listening-active behaviour. Record the actual version and date.
- Check completion/history across restart and show that it is local. Do not turn a stored completion mark into a guarantee of mastery or a per-church cloud profile.
- Founder reviews the design rationale and headline. Publish only after the feature's availability and guide destinations are confirmed. The article remains an unpublished draft with no invented publication date.
- This expands the existing article 19 rather than adding a duplicate onboarding introduction. The October 11 library validation is a historical baseline; it does not validate this revised text. Follow-up link, metadata and claim checks are recorded with this writing task.
