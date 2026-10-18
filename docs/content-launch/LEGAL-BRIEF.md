# Trilorah privacy and terms drafting brief

Internal drafting record, October 17, 2026. This is the factual preparation for a Privacy Policy and Terms of Use. It is not a policy or agreement to render on the website.

The [Privacy Policy draft](../legal/PRIVACY-POLICY.draft.md), [website/account terms draft](../legal/TERMS-OF-USE.draft.md), [source licence and scope](../legal/LICENSING.md), [community setup docs](../community/README.md) and [support draft](../support/SUPPORT-PAGE.draft.md) are now written. PolyForm Perimeter 1.0.1 is applied following the founder's request to return to the previously discussed licence. Use the [open facts](../legal/OPEN-FACTS.md) and [publication checklist](../legal/PUBLISHING.md) for remaining product/deployment checks. Paid-service terms remain deferred with the offering itself.

## Founder information

| Item | Current information | Needed before final copy |
| --- | --- | --- |
| Operating base | Founder supplied Texas, USA, “for now” | Confirm business location and intended launch markets |
| Legal operator | Ayotomiwa Durojaye, supplied by founder | Use this name for the current operator; no company incorporation or registration is being assumed |
| Business model | Source-available software with an optional Trilorah-operated paid service to define later | Leave paid deliverables, provider billing, prices and commitments open as requested; current covered code rights are governed by PolyForm Perimeter 1.0.1 |
| Project licence | PolyForm Perimeter 1.0.1 applied to current covered original source; root LICENSE and NOTICE identify the terms and licensor | Preserve earlier valid grants and third-party rights; verify release contents; providing competing products is restricted even if free |
| Domain | Founder has access to addresses at trilorah.com | Confirm the public website and active contact addresses |
| Email capacity | Up to five addresses; founder does not want to use all five unnecessarily | No need to allocate them all |
| Suggested help address | support@trilorah.com; founder confirmed it is not active on October 17, 2026 | Activate it and assign someone to monitor it |
| Suggested privacy address | privacy@trilorah.com; founder confirmed it is not active on October 17, 2026 | Activate it and establish the request process |

The two suggested addresses may share a monitored inbox if the email provider supports aliases. They are recommendations and are not active yet. A general hello@ address can be added later if it serves a distinct need.

“Legal operator” means the person or legal entity offering the service and making the agreement. The founder has supplied Ayotomiwa Durojaye for the present operator. Applicable business-name arrangements and any later company role are separate matters; do not infer incorporation from the brand or location.

## Software licence and paid service terms

The founder's latest instruction returns to PolyForm Perimeter 1.0.1, superseding the intervening Apache-2.0 choice for the current covered source. Its restriction includes providing competing products free of charge; do not describe it as allowing unrestricted public competing forks or as standard open source:

- The applied source licence explains rights and conditions for covered original code. Church use and internal customisation are permitted; providing competing products is restricted. Keep this distinct from website or managed-service terms.
- Terms for the website, accounts and any paid services explain the actual service, payment, support and termination arrangements. Keep them consistent with the rights actually granted by the selected source licence.
- The Privacy Policy describes the operator's actual processing across its website and services. Identify what happens on a church's computer or self-managed infrastructure separately from processing by Trilorah and third-party providers.

Possible paid value includes managed cloud/AI usage, setup and support. The founder has not selected the exact combination and has explicitly chosen to decide later. Proceed with source-licence work, verified privacy information and community documentation independently. Final paid-service clauses wait for a defined offering. Do not invent a “Pro” plan, subscription price, response-time guarantee or free unlimited usage. Retain a clear community installation path and explain any external costs alongside it.

Before distributing a release, verify the scope/compatibility and required notices for bundled third-party code, content and assets. PolyForm Perimeter 1.0.1 is applied locally; it does not relicense those third-party materials or certify their permitted uses. Changing the current licence does not revoke valid licences already granted for earlier copies; preserve applicable earlier terms. A local licence edit does not by itself prove earlier public distribution. Perimeter recipients must receive its terms or URL and the supplied Required Notice lines. Package metadata uses `SEE LICENSE IN LICENSE` because this licence has no current SPDX identifier.

## Facts to establish for privacy

Inspect the actual release and configured services. This is an inventory to complete; listing a category here does not mean Trilorah collects it in every setup.

| Area | Questions to settle |
| --- | --- |
| Website and account | What signup/contact information, session cookies, browser storage, hosting logs and analytics are actually used? Which operator or service receives each item? |
| Church and service data | What church profile, prepared content, service records or device information stays on the computer, and what is synced or shared? Which sharing options are enabled by default? |
| Audio and transcription | When is audio captured, streamed or saved? Which speech provider receives it, under whose account, in which mode? How are transcripts stored and deleted? |
| AI-generated material | Which inputs are sent for note generation or other model features? Which providers and account terms apply? What are their retention and training settings? |
| Congregation sharing | Who can access live passages, transcript, notes and participation data? How are links, access, stored entries and session endings handled? |
| Local records and credentials | What local databases, preferences, API credentials, diagnostic records or backups exist? What export, deletion and reset actions actually work? |
| Service providers | Record the actual active providers, purposes, data received, account owner, hosting regions and relevant terms. A dependency in package.json is not proof that it processes production data. |
| Retention and requests | Establish actual deletion/retention periods, backup behaviour, who handles access/deletion requests and what the church controls directly. Code for cleanup alone does not establish a production schedule. |
| Business practices | Confirm sale/sharing, marketing emails, product analytics and any model-training use. Do not invent “never” promises. |

For each active flow, record: data, purpose, trigger, local/remote destination, recipients, retention/deletion, user controls, evidence, reviewed release and the business decision still needed. Inspect deployment configuration and provider settings as well as code. Keep secrets and real church data out of this record.

Begin the technical trace at account routes under `web/src/app/app`, website session handling, desktop audio/engine providers, `electron/cloud`, congregation-sharing routes, notes generation and local settings/storage. Exact provider and retention statements need a focused audit, not an inference from this path list.

## Decisions to establish for terms

- The legal operator and the service, desktop software and website covered by the agreement.
- The community path and the optional paid-service offering; whether each is generally available or in beta, consistently with PolyForm Perimeter 1.0.1's code rights and any applicable earlier grants.
- Account responsibilities, authorised users and relevant access restrictions.
- The licence offered for desktop use; how third-party assets, Bible texts, song lyrics and uploaded material are handled.
- What rights the operator needs to host/process user material for the enabled service, and what remains the user's responsibility.
- Third-party provider/API costs and terms, where used.
- Paid billing, renewal, cancellation and refund choices if applicable; do not introduce a subscription if there is none.
- Actual support commitments, service changes, suspension, termination and data export/deletion after termination.
- AI/recognition limitations and user review, stated consistently with actual controls.
- Appropriate warranty, liability and dispute provisions for the actual operator, customers and jurisdictions, with qualified legal review.

Texas is the founder's current operating base. It does not by itself settle incorporation, contractual governing law or every privacy obligation for the intended audience. Establish those facts before selecting jurisdiction-specific clauses.

## Drafting order

1. Use the supplied operator name and applied PolyForm Perimeter 1.0.1 licence; confirm active contact details. Keep the optional paid-service definition deferred as requested.
2. Trace the enabled data flows and compare them with configured provider practices.
3. Complete the Privacy Policy and community/support documentation with unresolved items tracked internally. Write paid-service terms when that offering is defined. Keep any concise user-facing data-handling explanation aligned with the policy.
4. Review the documents for the actual jurisdictions and business arrangement, reconcile them with product behaviour, and add their final contact links, version and effective date.
5. Implement the pages and any relevant consent, request or account flows. Publishing a policy does not implement the practices it describes.

Consider a separate cookie explanation, church data-processing agreement or provider list when the verified practices and customer arrangements call for one. Do not populate a footer with generic legal documents merely to fill it.

Use plain, precise wording. Keep jokes out of permissions, legal commitments, billing and data rights. Do not manufacture a privacy guarantee to match the marketing tone.

## Research references

- [FTC consumer privacy guidance](https://www.ftc.gov/business-guidance/privacy-security/consumer-privacy) emphasises clear, accurate privacy promises and practices. It supports fact-first drafting; it does not resolve Trilorah's full legal position.
- [ICO privacy information guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/) covers identity, purposes, recipients, retention and rights in its UK context. Its applicability must be assessed for the audience, and the page states that guidance is under review following legislative changes.
- [Texas Secretary of State business structures](https://www.sos.texas.gov/corp/businessstructure.shtml) distinguishes individual sole proprietors from formed entities and explains assumed-name filings. Confirm the actual structure rather than assuming an LLC from the brand name.
- [PolyForm Perimeter 1.0.1](https://github.com/polyformproject/polyform-licenses/blob/1.0.0/PolyForm-Perimeter-1.0.1.md) supplies the current terms and expressly covers free competing products in its competition restriction.
- [Open Source Initiative FAQ](https://opensource.org/faq) explains open-source licensing, commercial use and sales. The current Perimeter licence is described as source-available, not standard open source; the actual licence controls the code rights.
- Supabase's [self-hosting guide](https://supabase.com/docs/guides/self-hosting) and [managed platform pricing](https://supabase.com/pricing) provide a reference for the founder's commercial direction, not evidence of Trilorah's delivered services or exact plan design.
