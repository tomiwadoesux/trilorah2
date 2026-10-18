# Legal drafting research and source recheck

Internal notes, October 17, 2026. These explain drafting decisions, not a finding of compliance or a replacement for reviewing the actual service and markets. No production settings, accounts, secrets or real congregation records were accessed. No source behaviour, database, inbox or licence was changed.

## Official sources checked

| Source | Relevance to this draft |
| --- | --- |
| [FTC consumer privacy guidance](https://www.ftc.gov/business-guidance/privacy-security/consumer-privacy) | Privacy statements must match actual practices. This supports keeping source facts, provider configuration and unverified business promises separate. |
| [Texas AG: Texas Data Privacy and Security Act](https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint/consumer-privacy-rights/texas-data-privacy-and-security-act) | Describes applicability/exemptions, disclosures, requests/appeals and sensitive information, including religious beliefs. A small-business or nonprofit exception cannot be assumed from the product's church audience. Which duties apply needs assessment of the operator and actual processing. |
| [Texas Legislature: enrolled HB 4](https://capitol.texas.gov/tlodocs/88R/billtext/html/HB00004F.htm) | The AG links this enacted text. Sections 541.001, .002, .051–.055 and .101–.107 identify issues for review, including sensitive information and the distinction between specific consent and accepting broad terms. This is the enrolled act, not independent verification of all later amendments or applicable law. The legacy codified chapter URL returned the statutes home page during this check. |
| [Texas Secretary of State: business structures](https://www.sos.texas.gov/corp/businessstructure.shtml) | A brand name and Texas address do not establish an incorporated entity. The draft uses the founder-supplied individual operator. |
| [Official PolyForm Perimeter 1.0.1 text](https://github.com/polyformproject/polyform-licenses/blob/1.0.0/PolyForm-Perimeter-1.0.1.md) | Permitted internal uses and modifications remain subject to the actual licence. Its competing-product restriction includes free offerings; preserve the required notice and distinct third-party terms. Website terms do not rewrite its software rights. |

The terms are a proposed basic agreement, not a copied SaaS contract. Billing, perpetual content rights, unrelated marketing use, arbitration, forum, indemnity and a monetary liability cap have not been invented. Contacts, assent, operational commitments and any final risk allocation remain in [OPEN-FACTS.md](OPEN-FACTS.md).

## Source recheck for this draft

The [desktop evidence](evidence-desktop.md) and [web/cloud evidence](evidence-web-cloud.md) were the starting inventory. Relevant current functions were read again. The current working tree has changes beyond the earlier evidence:

| Claim | Current source checked | Drafting consequence |
| --- | --- | --- |
| Listening can open public sharing | `electron/main.ts`, `ensureCloudService` and `start-listening`; `electron/cloud/cloudSync.ts`, `startService` | Requires cloud configuration and an account; public/transcript flags default true. State the trigger and conditions. The practice source is excluded. |
| Stopping listening is not ending the cloud service | `electron/main.ts`, `stop-listening` | Do not describe Stop as a complete cloud-sharing or deletion control. |
| Display flags do not gate transcript upload | `electron/cloud/cloudSync.ts`, `pushTranscriptChunk` | Active service/rehearsal/text checks are separate from display/public flags. Preserve this distinction in both drafts. |
| Generated notes can be cloud processing despite the local label | `electron/llm/notesProvider.ts`, `localNotesProvider.generate` | Both branches delegate to cloud. The policy says so rather than adopting the source comment's future local-model description. |
| Public service history is not limited to four weeks by the route | `web/src/app/live/[slug]/page.tsx`; `components/TranscriptArchive.tsx` | The route no longer has a 28-day filter and accepts a pinned `?service=` URL. Archive history paginates public services without an age cutoff. Its transcript loader requests the complete published history for the chosen service. Earlier evidence about a four-week public-page limit is stale. Actual backend access/retention still requires deployment verification. |
| Feed discovery still has a separate recent-service window | `web/src/app/live/[slug]/useCompanionFeed.ts`, `discover` | Unpinned live discovery uses a date filter, but initial route/history/pinned reads differ. Do not turn that discovery filter into a universal access or retention claim. |
| Automatic visitor data remains | `web/src/app/live/[slug]/CompanionClient.tsx`, visit effect and `useFingerprint` | Requests ipapi.co automatically; writes IP, city/country, browser/device, persistent random ID and timestamps to Supabase; heartbeat every minute. The effect also runs for a saved service. No consent condition was found in the effect. |
| New personal notebook remains in browser storage | `web/src/app/live/[slug]/useNotebook.ts`; `web/src/lib/companionNotebook.ts`; `components/NotesTab.tsx`; `components/VersesTab.tsx` | Notes and saved passages use the per-church `trilorah-notebook-v1:` localStorage key. No notebook upload appears in these paths. Explain browser-profile access and clearing/exporting; do not call the entire congregation page private. |
| Sharing creates additional copies | `web/src/app/live/[slug]/components/ShareActions.tsx` | Share invokes browser sharing or clipboard; Download creates a text-file Blob. Reader copy distinguishes a locally written notebook from a copy deliberately shared/exported. |
| Account terms are not implemented assent | `web/src/app/app/signup/page.tsx` | The inspected signup form calls authentication/account setup without a terms control or acceptance-version record. Terms body is proposed; acceptance and final links remain integration work. |
| Desktop authentication/session persistence | `electron/cloud/supabaseClient.ts` | Supabase handles sign-in. Local session storage is electron-store with no explicit encryption configuration here; no keychain or encrypted-storage promise was added. |

No Supabase implementation or query was required. The Supabase skill was read; its changelog Markdown could not be rendered by the browser tool (unsupported content type). No claim about a new SDK or changed provider feature relies on that fetch. Production RLS, table grants, backend RPCs and provider contracts remain unaudited; client queries do not certify access controls.

Recheck these paths, the intended release and configured providers after product changes. The policy body describes current source behaviour where established; publication still depends on the substantive facts and operations in OPEN-FACTS.md.
