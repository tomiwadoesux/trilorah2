# Web and cloud privacy evidence

Internal source record for the Privacy Policy and support documentation. Reviewed October 17, 2026, against the current working tree. This is an inventory of implemented code, not a statement that a release or deployment has been tested.

Scope: `electron/cloud`, its active main-process callers, `web/src`, phone-microphone signaling, and the cloud-related desktop settings. No secrets, `.env` values, real user records, deployed Supabase policies, logs, database functions or infrastructure settings were accessed. No cloud queries or app changes were made.

Same-day follow-up: the public route was rechecked while drafting the website/account terms and updated policy. It now has no 28-day service filter and accepts a pinned `?service=` ID. The public-access and retention descriptions below reflect that current route rather than the earlier four-week query. New browser-notebook storage and public history traces are recorded in the [legal source recheck](legal-research.md#source-recheck-for-this-draft).

## Material findings for the policy writer

- Cloud accounts use Supabase authentication. Account setup sends an email, password and account/church name; the church also chooses a public URL slug. The desktop persists the cloud session using an `electron-store` file. The website uses Supabase SSR/browser clients and session cookies.
- A signed-in desktop with a configured cloud account can start a public cloud service when **Start Listening** is pressed. That service defaults to public visibility and transcript publication. Starting audio is therefore not necessarily a local-only action or a separate deliberate "publish" action. The practice sermon is excluded.
- The public congregation page collects attendance information automatically when it has a service: a persistent random browser identifier, IP address returned by ipapi.co, city, country, user agent, device label, service/account IDs and visit timestamps. A heartbeat refreshes `last_seen` every minute. This is not fully anonymous data merely because the code calls its random ID a fingerprint or shows aggregate results to the operator.
- The public page can display the latest public service or a service selected through a pinned link, including saved transcript chunks, scriptures and notes after the service ends. Its current query has no service-age limit. Other four-week read filters do not prove data is deleted after four weeks.
- No checked-in database migrations/schema/RLS definitions or body for `run_retention_cleanup` were found. No account-deletion flow or cloud-content deletion implementation was found in the reviewed source. Production access rules, backup lifetimes, deletion procedures and scheduling remain unknown.
- Optional stream embeds contact YouTube or Facebook when the visitor opens the player. Giving buttons open third-party payment destinations; the reviewed giving component does not itself collect card details or process a donation.
- Phone microphone pairing sends device identity and connection metadata through Supabase broadcast and uses a Google STUN server for WebRTC. The phone audio travels to the desktop through WebRTC; the desktop's later processing is a separate data flow. Avoid a product-wide promise that audio never leaves the local network.

## Accounts and authentication

| Flow | Data and recipient | Conditions and source evidence |
| --- | --- | --- |
| Website registration | Email, password and `account_name` metadata to the configured Supabase Auth service | `web/src/app/app/signup/page.tsx:27` calls `auth.signUp`. `churchName` and cleaned public `slug` are sent to `complete_account_setup` at line 48 when a session is available. If email confirmation is enabled and no session is returned, the UI delays setup; actual confirmation configuration is not proven by the code. |
| Website login | Email and password to Supabase Auth | `web/src/app/app/page.tsx:19`, `auth.signInWithPassword`. |
| Desktop registration/login | Email, password and account-name metadata to Supabase Auth | `electron/cloud/supabaseClient.ts:85`, `signIn`; line 96, `signUp`; account setup RPC at `electron/cloud/cloudSync.ts:349`. |
| Desktop session persistence | Supabase session strings stored locally in named `trilorah-session` electron-store | `electron/cloud/supabaseClient.ts:15`–17 constructs the store; `getSupabase` at line 64 sets `persistSession: true`, `autoRefreshToken: true`, and store-backed get/set/remove. No explicit encryption option is supplied here. Do not promise OS-keychain protection from this code. |
| Website session handling | Supabase SSR/browser auth cookies | `web/src/lib/supabase/browser.ts:4`, `createBrowserClient`; `web/src/lib/supabase/server.ts:4` reads/writes cookies; `web/src/middleware.ts:7` creates an SSR client and refreshes response cookies. Exact cookie lifetimes/options depend on the installed SDK and deployment. |
| Authenticated web access | Account identity, organization, linked-campus details and service history | Middleware guards `/app/*` except login/signup (`web/src/middleware.ts:27`–40). Dashboard queries owner account, organization campuses, services and preacher profiles (`web/src/app/app/dashboard/page.tsx:18`–46). Source-level query scoping is not independent proof of deployed database RLS. |
| Multi-campus linking | Generated or entered link code to Supabase RPCs, with resulting organization linkage | `web/src/app/app/dashboard/LinkCodeManager.tsx:22` and line 35 call `generate_link_code` and `redeem_link_code`; desktop equivalents are at `electron/cloud/cloudSync.ts:324` and 336. UI says 24-hour expiry at web line 102, but the RPC implementation is absent and that expiry is not verified. |
| Sign-out | Session sign-out requests | Web `web/src/app/app/dashboard/SignOutButton.tsx:11`; desktop `electron/cloud/supabaseClient.ts:112`; global Supabase sign-out at `electron/cloud/cloudSync.ts:510`. Signing out is not account deletion or deletion of service records. |

The desktop supports environment overrides and compiled-in Supabase defaults (`electron/cloud/supabaseClient.ts:47`–51). The web client uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`web/src/lib/supabase/browser.ts:4`–8). The files establish configurable service destinations, not who legally operates a particular project, its region, terms or subprocessor arrangement.

## Cloud service records and publishing

`startService` (`electron/cloud/cloudSync.ts:147`) needs a configured Supabase service and a signed-in account. It inserts account ID, optional preacher ID/title and publication settings into `services`. Defaults at lines 161–163 are `is_public: true`, `publish_transcript: true` and `audience_training_enabled: false`.

`electron/main.ts:2146` (`ensureCloudService`) invokes this when listening starts, unless sharing is paused, the service already exists, or cloud configuration is absent. The normal **Start Listening** IPC handler at line 2170 starts audio and calls it; the practice-sermon device is excluded at line 2174. `publicSharingPaused` starts as in-memory `false` (`electron/main.ts:81`). Explicit cloud-end sets it true (`electron/main.ts:3599`), while cloud-start sets it false (line 3594). No durable pause preference is established by those statements.

The active service gates the following queued records in `electron/cloud/cloudSync.ts`:

| Table / function | Payload fields observed | Source |
| --- | --- | --- |
| `segments` / `pushSegment` | Service ID, segment type, confidence, start time | Line 215 |
| `transcript_chunks` / `pushTranscriptChunk` | Service ID, text, final flag, segment type, optional word text and timing, offset within service, timestamp | Line 230 |
| `detected_verses` / `pushDetectedVerse` | Random record ID, service ID, Bible reference, source, confidence, whether sent live, push timestamp | Line 258 |
| `detected_verses` / `markVersePushed` | Record ID, live flag, push timestamp | Line 283 |
| `sermon_notes` / `upsertNotes` | Service ID, title, theme, main points, definitions, applications, memorable quotations, scripture list, live flag | Line 297 |
| `services` and `sermon_notes` / `endService` | Service end timestamp and notes' `is_live: false` | Line 181 |
| `accounts` / `syncGivingMethods` | Configured giving methods | Line 316 |

The active engine calls `pushDetectedVerse` from `electron/main.ts:1300` and final `pushTranscriptChunk` from line 1440. The cloud functions refuse rehearsal data (`cloudSync.ts:215`, 237, 264, 298). `upsertNotes` is exposed by main IPC at `electron/main.ts:3609`; code presence alone does not demonstrate every notes producer or a released end-to-end notes service.

**Publication flags and storage are different.** Transcript enqueue in `pushTranscriptChunk` checks active service/rehearsal/text, but does not test `is_public` or `publish_transcript`. Thus switching publication flags must not be described as preventing all transcript upload. Actual public-read enforcement depends on database policies that were not available in this checkout.

### Local offline upload queue

Pending table writes are JSON payloads stored in `cloud-queue.json` under Electron `userData` (`electron/cloud/offlineQueue.ts:44`–64). They can include sermon text, notes and references. Enqueue persists immediately (`:73`); successfully applied writes are removed, retryable failures remain, and permanent refusals are removed and surfaced as notices (`:89`–135). A periodic 15-second flush and short 250ms flush nudge are implemented at `electron/cloud/cloudSync.ts:97` and 125. There is no queue age expiry in this file. Do not promise pending content disappears on sign-out or after a fixed retention period.

## Public congregation page

`web/src/app/live/[slug]/page.tsx:19` calls `public_account_by_slug`, expecting only account ID, name, slug and giving methods. The route's code comment states the full accounts table has no anonymous read policy; without the SQL this is an intended constraint rather than verified production access.

The page selects the latest `services` row with matching account ID and `is_public: true`. A `?service=` query selects a particular public service for that account; invalid or unavailable pinned IDs produce a not-found response. There is no 28-day or other age filter in the current route. It does not require congregation login. `web/src/app/live/[slug]/useCompanionFeed.ts` reads transcript chunks, scriptures pushed live, notes and current segment through queries and realtime subscriptions. These source-level filters do not certify deployed database policies.

The visitor-facing page filters by account and public state but does not itself check church Wi-Fi membership. Separate desktop relay logic applies `companionShareMode === 'wifi-only'` when processing a `hello` frame; that does not establish access control for this web/Supabase path. Do not promise the public URL is private or restricted to local Wi-Fi based on the settings label alone.

### Attendance information

`web/src/app/live/[slug]/CompanionClient.tsx:250` (`useFingerprint`) creates a random UUID and keeps it under `trilorah_fp` in browser localStorage. This is a stable identifier until browser data is cleared; the inspected implementation does not derive it from canvas, hardware or a collection of fingerprinting attributes.

When a service and ID exist, the effect at line 78:

1. Reads `navigator.userAgent` and derives a device/browser label.
2. Requests `https://ipapi.co/json/` automatically (line 92). This exposes the requester's network IP to ipapi.co and receives IP/city/country. Geolocation failure is tolerated.
3. Upserts `audience_sessions` with service/account IDs, identifier, raw returned IP, city/country, truncated user-agent string, device label and `last_seen` (line 104).
4. Refreshes `last_seen` every 60 seconds (line 124).

No attendance opt-in or consent condition is implemented in this effect. The UUID is also created while the page is waiting for a service, although the attendance write waits for a service ID. The effect does not require that the service is currently live, so visiting a saved public service can also record attendance.

Operator views read attendance counts/cities in web service detail (`web/src/app/app/services/[id]/page.tsx:89`–115). Desktop `fetchAudienceSessions` selects individual session IDs, service IDs, city/country, device label, `first_seen`, `last_seen` and user agent for the account (`electron/cloud/cloudSync.ts:471`). The fact those UI queries do not select IP does not mean Supabase never stores IP.

Optional audience feedback inserts `service_id`, detected-verse ID, correction type (`wrong-verse` or `no-verse`) and the same browser ID into `correction_taps` (`web/src/app/live/[slug]/components/VersesTab.tsx:42`). The control is displayed only when audience training is enabled and the newest verse is within its feedback window. The reviewed frontend does not establish what backend learning or retention that feedback triggers.

### Browser storage and preferences

| Storage | Purpose and evidence |
| --- | --- |
| Auth cookies | Supabase browser/SSR session support, described above. |
| `trilorah_fp` | Random persistent attendance/feedback identifier (`CompanionClient.tsx:250`). |
| `trilorah-reading:<church ID>` | Reading colour, text size and optional locally processed background photo (`ReadingOptions.tsx:16`–46). Photo is decoded/scaled and saved as JPEG data URL in browser storage; no upload call appears in this component. |
| `trilorah-notebook-v1:<church ID>` | Personal notes and saved passages in the browser profile (`useNotebook.ts`, `companionNotebook.ts`). No notebook upload appears in these paths. Sharing or downloading creates a separate copy through `ShareActions.tsx`; clearing storage can remove the local notebook. |
| `trilorah_sync_nudge_ms` | Transcript synchronization preference (`web/src/lib/syncPrefs.ts:14`, 42, 51). |
| `trilorah_mic_name`, `trilorah_mic_id` | Phone name and random phone ID for microphone pairing (`web/src/app/mic/MicClient.tsx:22`–34, 74–77). |
| Design-preview preferences | Hero theme and brand notes/shortlists are also saved in localStorage on design routes (`web/src/app/hero/useHeroTheme.ts:13`; `web/src/app/brand/components/ComponentLibrary.tsx:42`; `web/src/app/brand-directions/BrandDirections.tsx:184`). These should not be confused with production audience tracking. |

No analytics SDK, advertising pixel or general analytics script was found in the inspected `web/src` and `web/package.json`; root layout uses a local font (`web/src/app/layout.tsx:7`). This is a bounded code finding, not a guarantee about hosting/CDN access logs, injected deployment scripts, extensions, embeds or future configuration.

## External services and links

- **Supabase:** account authentication, database writes/reads, realtime congregation delivery and phone-mic signaling. Legal operator, project region, service agreement and configured log/backup retention are unverified.
- **ipapi.co:** automatic IP-derived city/country lookup on congregation pages with a service, described above.
- **YouTube / Facebook:** `StreamPlayer` initially shows an unopened control and mounts an iframe only after the viewer opens it (`web/src/app/live/[slug]/components/StreamPlayer.tsx:30`–63). YouTube also loads `https://www.youtube.com/iframe_api` (`:194`–207). `web/src/lib/streamEmbed.ts:73` returns `www.youtube.com/embed`, even for a recognized `youtube-nocookie.com` input. Do not describe this implementation as privacy-enhanced/no-cookie embedding.
- **Giving destinations:** Venmo, Cash App, PayPal or a church-entered custom URL open externally; Zelle/bank details can be copied (`GiveTab.tsx:26`–60, 108–121). The component has no card-entry or donation-charge API. Published giving fields may themselves contain contact or financial account information provided by the church.
- **GitHub releases:** download configuration links to GitHub release assets (`web/src/app/download/release.ts:4`–6). Downloads can be subject to the hosting provider's request logging; actual deployment/log practice is not established here.

## Phone microphone signaling

The visitor first connects with a code; the desktop must approve before browser microphone permission is requested (`web/src/app/mic/MicClient.tsx:184`–190, 129–140). The phone stores its name/ID, joins a code-named Supabase broadcast channel and sends `hello`, SDP offers and ICE candidates (`:217`–235, 160–178). Desktop messages include an approval with laptop name, SDP answer and ICE candidates (`electron/mic/phoneMicLink.ts:97`, 109). The channel factory describes public broadcast access keyed by a ten-character pairing code (`:200`–224); this is not an authenticated account-private channel.

`new RTCPeerConnection` uses `stun:stun.l.google.com:19302` (`MicClient.tsx:143`). Audio tracks go into that peer and the same peer returns transcript snippets and scripture references to the phone (`:145`–157). The inspected web component has no recorder/upload-to-storage function, but no-recording claims must also account for the desktop's downstream ASR, practice/training, local persistence and cloud publishing. A two-minute pairing timer is code-backed; provider signaling logs/retention are not.

Separate relay viewer statistics hold IPs in memory, and can report rounded small-city counts (`electron/companion/viewerStats.ts:80`, 108). This is a different path from the cloud attendance rows. Its comments about never persisting IP cannot be generalized to the complete product.

## Retention, deletion and unknown production facts

`electron/cloud/cloudSync.ts` merely calls an RPC named `run_retention_cleanup`. The renderer bridge exposes it. No function body, SQL schema, expiry schedule or invoking UI caller was found in this audit. The current public website route has no age filter; `fetchRecentNotes`/`fetchAudienceSessions` four-week filters are read limits, not deletion mechanisms. Ending sharing sets an end timestamp rather than deleting the service or its content (`endService`).

Before publication, confirm:

- The actual database schema, table policies/grants and public/owner/organization access boundaries, including realtime and anonymous visitor writes.
- Which runtime/release is distributed and whether listening/publication defaults and notice/consent are the intended product behaviour.
- Retention for accounts, service records, transcript/notes, visitor identifiers/IP/location, correction data, provider logs and backups; who runs cleanup and how often.
- A practical access/correction/deletion/export request process, identity checks, church/operator authorization, backup treatment, and any applicable processor/controller arrangement. No self-service cloud account deletion was established by this audit.
- Hosting/CDN, authentication email provider and support/email providers; countries/regions, contractual roles and current settings.
- Whether automatic geolocation and persistent attendance identification should remain, how visitors are informed and what controls exist. These are current facts to disclose or deliberately change, not promises to invent in a policy.
- Whether published material can contain private prayer requests, names, health information or information about children; the church controls the source content, but the service can still process it. Do not categorically claim no sensitive data can be processed.
- Deployment and operational facts that cannot be inferred from the known legal identity and licence. The operator is Ayotomiwa Durojaye and the current licence is PolyForm Perimeter 1.0.1; the founder confirmed on October 17 that the proposed support and privacy addresses are not active yet. These facts do not answer infrastructure or retention questions.

This record does not claim a security certification, guaranteed isolation, zero data collection, no sale/sharing under a particular statute, provider training exclusion, deletion deadline or legal compliance finding.
