# Future feature stories: six complete drafts

**Status:** six complete introductions, ready for draft review. Implementation rechecked October 11, 2026. The user authorized drafting in the agreed voice direction; individual lines still require normal editorial review. No article has been published, scheduled, or assigned a release date. Source review does not certify a released build.

These six ideas complement the existing [16 beginner articles](../README.md). They explain a product decision through a recognizable service moment, then link to the relevant instructions. They are not six more button-by-button tutorials. Their order is provisional and follows release readiness, not a fixed publishing quota.

The voice follows the latest [calibration](../voice-calibration.md): straightforward explanations with occasional dry observations and short asides. The mobile opening develops the user's preferred “phone has been promoted” premise; its parenthetical line is a draft choice, not a claim of individual approval. The rejected calendar and preacher-detour personification is excluded. Controls retain literal labels.

## Read the drafts

| No. | Draft | Role in the library |
| --- | --- | --- |
| 17 | [Your phone has been promoted.](17-mobile-remote.md) | Introduce the remote, show a rehearsal use case, and give the four pairing actions. |
| 18 | [The verse wasn't on the service plan.](18-scripture-catches.md) | Explain the value of catches while making operator control explicit. |
| 19 | [Show me where.](19-in-app-guide.md) | Introduce the supported guide interactions through one setup-dependent task. |
| 20 | [You already typed the programme once.](20-programme-import.md) | Show how the existing programme starts preparation, including a reusable example. |
| 21 | [Tell Trilorah what it got wrong.](21-preacher-corrections.md) | Explain verified feedback and the three teaching controls. |
| 22 | [The next volunteer needs more than a file name.](22-service-handoff.md) | Connect service packages to a complete, checked handoff. |

Each article keeps internal status and release checks in frontmatter, outside reader copy. Requirements that affect use remain in the article itself. The next-action links lead to the existing beginner guides rather than repeating their full instructions.

[Headline alternatives](headlines.md) contain ten options per article. [Launch snippets](launch-snippets.md) contain three optional excerpts per article, for later use alongside a checked release. They have not been posted anywhere.

## Story queue

| Order | Internal topic | Reader and service moment | What the story should explain | Useful follow-through | Publication gate |
| --- | --- | --- | --- | --- | --- |
| 1 | Mobile remote controls | An operator wants to check readability from a seat while retaining presentation controls. | The paired phone can select content, inspect preview/live state, send content live, move through prepared material, and clear the screen while the desktop runs the service. | A dedicated mobile setup guide; existing [screen guide](../articles/05-connect-the-right-screens.md). | Pair real phones, confirm desktop approval/revocation, exercise content types and loss of connection on the release build. |
| 2 | Scripture catches with operator control | The preacher leaves the prepared reading and names or quotes another passage. | Spoken references and recognizable quoted words provide different evidence; the operator reviews the suggestion and chooses what reaches the room. | [Recognition explanation](../articles/04-how-scripture-recognition-works.md) and [manual phrase search](../articles/09-find-scripture-from-a-phrase.md). | Record actual reference and quotation results, including a failed/ambiguous example; reconfirm the manual projection gate. |
| 3 | An in-app guide that points and waits | A first-time volunteer wants an online image and discovers the computer lacks a provider key. | Registered walkthroughs can point, click approved controls, type supplied words, and retain the task during supported setup detours. The user can take over. | [Volunteer training](../articles/14-train-a-new-volunteer.md); add a guide reference page once released. | Exercise the complete missing-key detour and recovery with valid credentials; verify takeover, reduced motion, and the supported task list. |
| 4 | Start preparation from the programme | The church office sends the service plan as a message or image. | Text/image input creates editable proposed rows; the operator checks them before they become the run, then adds the actual content and cues. | [Programme guide](../articles/16-turn-a-programme-into-a-service.md). | Test both image and text entry using the pictured example; document the existing-run and schedule effects. |
| 5 | Preacher-specific recognition corrections | The same book name is repeatedly misheard during a regular preacher's services. | Profiles keep verified recognition feedback and targeted teaching: book-name corrections, vocabulary, and ignored reference tails. Explain what each changes. | [Sound-check and review guide](../articles/15-preacher-sound-check-and-review.md). | Save and replay specific corrections, test model setup, and verify which settings/provider paths affect the result. |
| 6 | Prepared services that can be handed over | One volunteer prepares the service; another uses the presentation computer. | A .tri package can include selected service resources. Open and import serve different intentions; the receiving operator still checks content and room setup. | [Service handoff guide](../articles/11-save-and-transfer-a-service.md). | Complete a two-computer or clean-profile transfer with local assets, missing files, remote links, and replacement consent. |

## Components and visuals

These are production notes, separate from future reader copy. Use a component only when it answers a reader's question; do not give every article an identical layout.

| Story | Recommended component | Required visual | Optional supporting visual |
| --- | --- | --- | --- |
| Mobile remote | Compact “phone / desktop / room screen” responsibility diagram, plus a small supported-controls list. | Captioned recording of real phone selection → preview → deliberate Go live → room output. | Actual pairing/desktop approval screenshot with expired demo details; connection-loss state. |
| Scripture catches | Small two-path diagram: spoken reference / quoted words → suggestion → operator decision. | Real recognition clip with the tested wording and Bible version identified. | A short fallback example where the operator searches manually. |
| In-app guide | A captioned interaction recording; prose for the user's choices. | “Show me” and “I'll do it,” followed by a real takeover that stops the guide. | Missing-key detour, return to the retained query, and actual search result. |
| Programme import | Three-image sequence, with a plain-text equivalent of the sample programme. | Original programme → actual review rows → prepared run with content. | A corrected misread row; useful evidence of why review exists. |
| Preacher corrections | Three-row table distinguishing the kinds of teaching. | An original rehearsal example, verified correction, and observed retry. | Sound-check status with a caption explaining the local/service-provider distinction. |
| Service packages | Two-choice card for opening a service versus importing selected resources. | Resource selection and the same prepared service opened on the receiving computer. | A warning about an intentionally missing local file or remote resource. |

Use real UI and original rehearsal data. Captions should say what happened, not promise what a later version may do. A pairing image must not expose a working code. A clip needs captions and a written equivalent. The product screenshots, recordings, diagrams, and result measurements above have not been produced by this research task.

## What these stories must not imply

- Phone control is not a phone-only presentation engine, access from any internet connection, or the same thing as using a phone as a microphone.
- Scripture catches do not automatically send suggested passages live in the inspected runtime. Configured voice commands are a separate control and can affect the screen; do not broaden the catches claim into “speech can never control the screen.” A readiness score does not override the catches publication boundary.
- The guide has registered workflows. Source changes can refresh its control index, but new features still need reviewed instructions and completion conditions.
- Programme import does not supply missing lyrics, media, or slides. Adding rows to an existing run can duplicate segments and replaces the separate engine schedule.
- A saved preacher correction is not proof of improved recognition in all future services. This is not acoustic voice cloning.
- A saved service package does not make a remote URL offline or connect the receiving computer's audio and displays.

The six subjects show useful product choices. No competitor analysis or technical evidence here establishes that they are unique, difficult to copy, or a defensible market advantage. Avoid calling them a “moat” in reader copy without separate evidence.

See [source evidence and release checks](evidence.md) before publication. The drafts received separate structure, clarity, evidence, line, and headline passes: one service situation per piece; plain controls; nearby limitations; varied useful components; and links to the appropriate full guide. Actual product recordings and volunteer task checks remain open.
