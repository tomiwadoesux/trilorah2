# Trilorah documentation publication checklist

The [source licence](LICENSING.md) is now applied locally as PolyForm Perimeter 1.0.1 following the founder's request to return to the previously discussed licence. It restricts providing competing products, including free offerings; the current covered source is source-available. The [Privacy Policy](PRIVACY-POLICY.draft.md), [website/account terms](TERMS-OF-USE.draft.md), [community documentation](../community/README.md) and [support page](../support/SUPPORT-PAGE.draft.md) still need the publication checks below. This work has not published a website, repository or release or activated support contacts.

## Founder decisions

| Decision | Current state | Next step |
| --- | --- | --- |
| Legal operator | Ayotomiwa Durojaye, supplied by founder | Use this name in the current policy; update if a company later becomes the actual operator |
| Copyright notice | Ayotomiwa Durojaye named in NOTICE for original Trilorah source | Keep other contributors' and third parties' existing rights and required notices; verify release scope |
| Source licence | PolyForm Perimeter 1.0.1 applied; latest instruction replaces the current Apache-2.0 choice | Preserve the unmodified licence text, Required Notice lines and third-party terms; explain restrictions on competing products, including free offerings |
| Contacts | support@trilorah.com and privacy@trilorah.com proposed; founder confirmed both are not active on October 17, 2026 | Activate the two addresses or aliases, test replies and assign monitoring |
| Paid offering | Explicitly deferred by founder | Leave prices, inclusions and paid-service contract provisions open; do not revisit merely to finish unrelated docs |
| Publication date | Unset | Assign the actual effective date when the final policy is published |

## Product and deployment facts to settle

The [desktop evidence](evidence-desktop.md) and [web/cloud evidence](evidence-web-cloud.md) document source-reviewed behaviour. They do not certify a deployed configuration. Prioritise these before inviting users through a final Privacy Policy:

1. **Sharing on listening.** A configured, signed-in desktop can start a public cloud service when listening starts. Verify the intended release behaviour, visible notice and controls. Confirm who can access live and saved transcripts/notes. Source: `electron/main.ts` (`ensureCloudService`), `electron/cloud/cloudSync.ts` (`startService`), `web/src/app/live/[slug]/page.tsx`.
2. **Congregation attendance information.** The public page automatically requests IP/location from ipapi.co and writes the raw IP, persistent random browser ID, device information and timestamps. Decide which of these fields are needed and establish the notices/controls for the actual audience. Document the chosen implementation accurately. Source: `web/src/app/live/[slug]/CompanionClient.tsx`.
3. **Local notes label.** The option labelled local delegates note generation to the cloud provider. Correct or clearly reconcile the product wording and actual behaviour before making a local-processing promise. Source: `electron/llm/notesProvider.ts`.
4. **Public access and deletion.** Verify the actual database schema, policies and sharing defaults. A “Wi-Fi only” setting does not establish protection for the public web route, and turning off public transcript display does not itself stop uploads to an active cloud service. Ending sharing and filtering a page to recent services do not delete the underlying records. Confirm workable cloud/local deletion and export processes.
5. **Providers and retention.** Confirm the configured provider accounts, hosting regions, request/log/backup retention, training settings, operational cleanup and support-mail handling. Specify the operator's own marketing/analytics/sale-sharing practices. The checkout cannot supply these deployment/business facts by itself.

These are publication dependencies and product decisions. This documentation task did not change sharing, analytics, provider behaviour, database access or retention.

## Policy completion

Resolve the [open facts](OPEN-FACTS.md) using verified information before removing the draft status. The operator name is now supplied. Remaining privacy decisions include the actual effective date, operator practices, retention schedule, provider/location information and request procedure. Confirm the intended audience and any additional age-related or jurisdiction-specific requirements with qualified review; do not insert a generic children/age declaration or worldwide compliance claim as a substitute for that decision.

The final policy should reflect the chosen behaviour, including any product changes made after this audit. Keep source evidence internal and the published copy readable. Review the finished document for the actual jurisdictions, service role and data practices. The founder's Texas base alone does not settle every applicable rule.

## Website and account terms

The [terms draft](TERMS-OF-USE.draft.md) covers the website and connected account services. It keeps code rights under the applicable software licence and handles user material only for the service functions described. Complete its open legal and operational decisions, choose the actual acceptance flow, and make the Privacy Policy accessible before asking people to agree. Do not assume that saving this document implements account acceptance, deletion or an appeal process.

The optional paid service remains undefined. Add billing, cancellation and related terms when the offering is decided and before taking payment for it; the basic agreement does not establish a paid plan.

## Connect the writing to the site

After finalising the text, implement real website destinations for privacy, support and the beginner route. Link the applied PolyForm Perimeter 1.0.1 licence and scope to the actual public repository when publishing. Do not treat Markdown file creation as a published website page. Do not describe the current licence as standard open source or promise unrestricted free competing forks.

Changing the current licence does not revoke valid licences already granted for earlier copies. Preserve those applicable terms and notices alongside third-party rights. A local licence edit does not by itself prove earlier public distribution. Package metadata should read `SEE LICENSE IN LICENSE`; recipients must receive the Perimeter terms or their URL and the supplied Required Notice lines.

The coding agent should use [AGENTS.md](../../AGENTS.md), [product context](../../.agents/product-marketing.md), [tone](../content-launch/TONE.md) and [page briefs](../content-launch/WEBSITE-WRITING.md). Convert relative repository links into working site routes during integration. For the guide, preserve the existing map-driven short lessons; longer documentation needs an actual rendering/integration path.

Check links, mobile reading, keyboard operation, visible contact details and the relevant install/rehearsal workflow. Follow the project's UI checklist before a final push that includes website/UI changes. No UI was changed in this writing pass.

## After publication

Take a new volunteer through installation, one service rehearsal and finding help. Correct the points where they hesitate before expanding the writing library. The [website and launch packet](../content-launch/website/README.md) now supplies FAQ answers, an About story, welcome messages, an announcement and demo script. Review and integrate those drafts, capture the demonstration, and write the first actual release note against the release's real changes and date. Paid-service terms and pricing follow when the founder resumes that decision.

## Legal research used

- [FTC consumer privacy guidance](https://www.ftc.gov/business-guidance/privacy-security/consumer-privacy): make privacy statements that match the operation of the product.
- [Texas Attorney General consumer privacy information](https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint/consumer-privacy-rights): a starting point for assessing the intended audience and applicable request procedures, not a determination that every provision applies to this operator.
- [Texas business-structure guidance](https://www.sos.texas.gov/corp/businessstructure.shtml): distinguish the operator's legal identity and business arrangement from the Trilorah brand.
- [PolyForm Perimeter 1.0.1](https://github.com/polyformproject/polyform-licenses/blob/1.0.0/PolyForm-Perimeter-1.0.1.md): source for the current licence, distribution notices and restriction on competing offerings, including free products.
- [Official Apache-2.0 text](https://www.apache.org/licenses/LICENSE-2.0): relevant to valid earlier grants, if any; section 2 makes the copyright grant irrevocable. Its inclusion here does not state that a previous Trilorah distribution occurred.
- [npm licence metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#license) and [SPDX licence list](https://spdx.org/licenses/): metadata fallback when a licence has no SPDX identifier.
