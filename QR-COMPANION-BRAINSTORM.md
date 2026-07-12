# QR Companion App — Brainstorm

Saved for later. This is the in-progress design conversation, not a plan. Pick up from here.

---

## Round 1 — User's original question

> lets brainstorm, the qr code feature, that in the service, the qr code will be in the screen, then the audinces can scan the code and se the live tanscrpts, verses que, and stuff. how will that work?? what is the flow of that

---

## Round 1 — Response

Good news first: a lot of the hard parts are already in the app. There's already a WebSocket server in `electron/api/websocketServer.ts` on port 8081 with a `broadcastToClients()` function that does exactly what a companion page needs. The `IncrementalNotesBuilder` already produces a live sermon outline. The verse emitter already broadcasts detections. So the question isn't really "can we do this" — it's "which of three architectures, and what's in v1."

### The one decision that changes everything: local wifi vs cloud relay

**Option A — Local-only (same wifi as church):**
- Electron app runs a tiny HTTP server on `0.0.0.0:8080` serving the companion page.
- QR encodes `http://192.168.1.42:8080` (the church machine's LAN IP).
- Phones connect over church wifi → WebSocket back to same machine.
- **Pros:** zero cloud dependency, nothing leaves the church, free forever, dead simple.
- **Cons:** congregants on cellular can't connect. Breaks if the pastor's laptop gets a new DHCP lease mid-service. mDNS (`trilorah.local`) helps but not on all phones.

**Option B — Cloud relay:**
- You host a small Node relay (fly.io / Render, ~$5/mo).
- Electron app opens an outbound WebSocket to the relay, receives a short code like `HOPE-2847`.
- QR encodes `https://trilorah.app/s/HOPE-2847`.
- Phones hit the hosted page, relay forwards events in both directions.
- **Pros:** works on cellular, no LAN config, short human-readable codes, multi-church.
- **Cons:** you're running infra, outbound internet dependency, transcripts leave the church (privacy question for some).

**Option C — Hybrid (what I'd pick):**
- Default local, but the companion page auto-falls-back to relay if the WS direct connection fails.
- Start v1 with only the local path working. Add the relay later without changing the Electron code much — it's just another transport.

Honest opinion: **start local-only**. You can ship something useful in a weekend. The relay is a straight add-on later and you'll have real usage data to decide if it's worth running.

### The flow, end to end

**Before service (setup — one click)**
1. Pastor hits "Start Companion" in the app. Electron:
   - Spins up a Fastify/Express server on port 8080 serving static companion HTML/JS.
   - Computes LAN IP (`require('os').networkInterfaces()`), builds `http://IP:8080/`.
   - Renders a QR code (use `qrcode` npm package) into a fullscreen overlay or a corner of the LiveMonitor output.
   - The existing WebSocket server on 8081 is already running.

2. Pastor adds a `[QR Code]` segment item (or the QR lives as a permanent overlay toggle in the control bar — I'd do the overlay, fewer clicks).

**During service (congregant opens their phone)**
3. They scan, browser opens the companion page served by the Electron app. Page immediately WebSocket-connects to port 8081 and subscribes to `companion` events.
4. Electron sends a snapshot on connect: current verse, current segment, last 30s of transcript, current outline state.
5. From then on, every time the existing IPC emits a verse/transcript/segment/notes event, the main process *also* calls `broadcastToClients({ type: 'verse', data: ... })`. You're adding one line next to each existing emit.

**On the phone — what they see**
A single-page app with tabs along the bottom:
- **Now** — current verse, big. Translation dropdown at top (KJV / NIV / ESV / RVR / etc). Tap to bookmark.
- **Queue** — pending detected verses that the operator hasn't pushed yet. Useful when the pastor mentions 3 verses in 10 seconds.
- **Transcript** — live running captions, auto-scrolling. This is the accessibility piece.
- **Outline** — incremental sermon notes as they build (comes free from `IncrementalNotesBuilder`).
- **Saved** — their bookmarks, localStorage only.

**After service**
6. A "Download your notes" button on the Saved tab generates a PDF/Markdown client-side from localStorage + the outline snapshot. No email, no server-side delivery needed for v1.

### Translations — the one new data problem

The main screen displays whatever version the pastor uses, but each phone wants its own. Two realistic ways:

- **Bundled**: ship 3–5 translations (KJV, WEB, ASV, BBE, one Spanish) as JSON files with the companion page. Each phone just looks up `book:chapter:verse` locally. ~15MB per translation. Works offline after first load. Legal: KJV/WEB/ASV/BBE are public domain; NIV/ESV are licensed and can't be bundled.
- **API passthrough**: the Electron app proxies lookups to `bible.db` (which already has the chosen version). You only ship the versions you legally have.

I'd bundle the public-domain ones and let the Electron side serve whatever is in `bible.db` on request. That gives you 4–5 translations without any licensing mess.

### What you need to build vs. what's already there

| Need | Status |
|---|---|
| WebSocket server with broadcast | **exists** (`websocketServer.ts:106-114`) |
| Verse emit | **exists** — just add a `broadcastToClients()` call next to the IPC send |
| Transcript stream | **exists** — same deal |
| Segment awareness | **exists** (`ServiceAgent` / `TransitionDetector`) |
| Sermon outline | **exists** (`IncrementalNotesBuilder`) — free feature for the companion |
| Static HTTP server for companion HTML | new (~30 lines with Fastify) |
| LAN IP detection + QR render | new (~20 lines, `qrcode` package) |
| Companion mobile web app | new — this is the main work |
| Client-side verse translation lookup | new (JSON files + tiny lookup fn) |
| PDF/MD export on phone | new, but all client-side (jsPDF) |

The actual "new code" here is mostly the mobile web app and a little glue. The live data pipeline is already built.

### MVP I'd ship first

1. Electron: Express HTTP server on 8080, serves a single HTML file with a minimal React/preact app.
2. Add `broadcastToClients()` next to the three places that currently emit verse/transcript/segment IPC events.
3. QR toggle in the LiveMonitor corner, or as a dedicated "Show QR" segment item.
4. Companion page: current verse (big), live transcript tab, nothing else.
5. Test on LAN with your own phone.

Ship that, use it once in a real service, then decide what's worth adding next (bookmarks? translations? outline tab? cloud relay?). The worst outcome is you build the full thing and realize nobody uses the transcript tab but everyone wants translation.

### The real questions

1. **Local wifi only, or cloud from day one?** I'd say local.
2. **Is the QR an always-on overlay corner, or a segment item you drop into the flow?** Overlay is lower-friction; segment item is more intentional.
3. **Translations — bundle public-domain ones, or do all lookups server-side via `bible.db`?** Bundling is offline-friendly; server-side is simpler.
4. **Transcript — is raw Deepgram output fine, or do you want the filtered/cleaned version?** Raw is cheaper, cleaned is nicer for hearing-impaired users who are reading every word.
5. **End-of-service delivery — client-side PDF download is fine, or do you actually want the email thing?** Email adds a real mail service dependency; download is free.

---

## Round 2 — User's upgrade

> waittt, so what if, on the website, the church makes an account, then before they use this software, they sign in to their account. so the transcriptions, the note making too all go to their site, if the operator goes to their account on the site, they see al the notes and stuff. and then the qr code, it links to an "open" place on the web, on the wrbsite too, but this is for the church, extraxting some data from their account to show to the public. will this worl

---

## Round 2 — Response

Yes, this will absolutely work, and it's actually the better architecture. What you just described isn't a companion feature anymore — it's a full **cloud-backed SaaS** where the Electron app becomes a client. That's a bigger lift but it unlocks things the local-wifi version can't do.

### What you just upgraded to

You went from "a QR page on the church wifi" to a three-tier product:

1. **Cloud backend** — auth, database, realtime channel, file storage. This is where the church's data actually lives.
2. **Web dashboard** — `trilorah.app`. Operators log in to see past sermons, transcripts, notes, export them, share them. Works from any device.
3. **Electron app** — becomes a client that talks to the cloud. It's still where the live service runs (Deepgram, verse display, OBS integration), but it syncs everything up to the cloud as it happens.
4. **Public QR page** — a read-only slice of the dashboard. Congregants open it, see the live verse/transcript/notes pulled from the church's account in real time.

This is a real product shape. Every church SaaS you've ever seen works this way.

### The one rule that can't be broken

**The Electron app must work offline for the live service.** Every single thing that happens in a Sunday morning service has to work if the internet dies. The cloud is the sync layer, not the runtime. If you get this wrong and the wifi dies mid-sermon, the whole service collapses — and that's the one thing churches can't forgive.

Practically this means:
- The Electron app still has its local sqlite `bible.db`, local settings, local preacher profiles, everything.
- Everything you currently save locally gets *also* pushed to the cloud as an event stream.
- Events queue locally when offline, flush when online. The service runs either way.
- The cloud side catches up within seconds of reconnect.

The Electron app doesn't become dumb. It becomes local-first with background sync.

### What the flow looks like

**Church signs up once**
- Pastor/admin goes to `trilorah.app/signup`, creates the church account.
- Gets `trilorah.app/app` (private dashboard) and `trilorah.app/live/hope-church` (public QR page).
- Downloads the Electron app, logs in once, token is stored.

**Every Sunday, before service**
- Operator opens app, already logged in.
- App pulls: schedule template, preacher profiles, recent sermons, settings from the cloud.
- Operator hits "Start Service" — creates a new `service` row in the cloud, the public page flips to "live" mode.

**During service**
- Everything happening locally also goes up as events: transcript chunks, detected verses, segment changes, notes updates.
- These events stream in near-real-time to: (a) the cloud database (persisted), (b) any operator or pastor watching the dashboard from another device, (c) the public QR page.
- If internet dies, events queue locally and flush when it comes back. Service never stops.

**After service**
- Operator hits "End Service." App flushes remaining queue.
- Cloud runs the sermon notes LLM generation **server-side** — this is a huge unlock: you pay for the HuggingFace/Claude/whatever API, churches don't need their own token. (Right now the audit found the user has to set up their own HF token, which nobody will actually do.)
- Operator can log into the dashboard from home later to review, edit, export.
- The public link stays as a permanent archive, or the operator unpublishes it.

### What this unlocks that the local version can't

- **Multi-device.** Pastor on iPad preparing, operator on laptop running the service, tech guy on phone monitoring — all seeing the same church account.
- **Review from anywhere.** Pastor opens their phone Tuesday morning, reads last Sunday's sermon transcript, pulls the verses they referenced.
- **You move API costs server-side.** HuggingFace calls, optional Claude/GPT calls for notes, Deepgram if you want to proxy it — all on your dime, priced into the subscription. Churches don't touch API keys.
- **You get telemetry.** You can see which features are used, ship updates, iterate.
- **Self-serve.** Churches sign up without talking to you.
- **The public page becomes shareable.** Congregant texts `trilorah.app/live/hope-church` to a friend. Friend opens it during the service on their couch, watches verses + transcript stream live.
- **Persistent archive.** Sermons are searchable forever. "Show me every sermon where pastor talked about grace" becomes a db query.

### What you take on

- **Infrastructure bill.** Small at first. Supabase free tier easily handles ~20 small churches. After that it scales with usage.
- **Operational responsibility.** If your database hiccups on Sunday morning you're getting texts. The offline-first rule mostly saves you here.
- **Auth + billing + support.** Password resets, invoices, onboarding questions.
- **Data responsibility.** You now store sermons for churches. EULA, privacy policy, data export on request, GDPR if any European churches sign up.
- **Churches depend on you staying alive.** If you lose interest, their data disappears unless there's an export path.

None of these are blockers — they're just real costs of running a product.

### The stack I'd actually pick

If I were building this tomorrow:

- **Supabase** for everything backend. Postgres + Auth + Realtime + Storage in one product, one bill, one dashboard. Their Realtime is perfect for the live event stream. Free tier is generous.
- **Next.js on Vercel** for the web dashboard + public QR page.
- **The Electron app stays 95% the same.** Add a `CloudSync` module that wraps writes to local storage with a parallel write to Supabase. Existing code doesn't know it's syncing.
- **Server-side LLM** — you call it from Supabase Edge Functions or a small Node service. Churches never touch HuggingFace/Claude/OpenAI keys.

Supabase is the right pick here because it gives you 4 products bundled and the realtime broadcasting you need is basically one line of code.

### The questions that actually matter before you build this

1. **Who pays?** Free tier vs paid? This affects every tech choice. If it's free forever you can't use paid infra. If it's $20/mo/church you have runway to use nice tools.
2. **How much of a sermon is public?** Is the public QR link the *full* transcript + notes, or just the verses the operator pushed? Some pastors won't want every "um" and "you know" archived publicly.
3. **Who in a church gets to log in?** Single account per church, or multi-user with roles (admin / operator / viewer)?
4. **Does the public page auto-expire or become an archive?** Or does the operator decide per-service?
5. **What about recordings?** Do you store the actual audio, or just transcripts? Audio is expensive to store but huge for value. (I'd say: metadata + transcript by default, audio optional per church.)
6. **Do you want to go paid SaaS from day one, or release as free-and-open while you learn?** Free lets you get users fast, paid forces you to get the value prop sharp.

### Recommendation on sequencing

Don't build this in one pass. Three phases, each ships real value:

**Phase 1 — Cloud sync without realtime (weeks, not months).** Just auth + a "save my finished service" endpoint. Operator finishes a service, it uploads. Dashboard shows a list of past services. No live companion yet. This gets you the backend foundation and the "review from anywhere" value.

**Phase 2 — Realtime sync during service.** Events stream up as they happen. Dashboard shows live service in progress. Multiple operators on multiple devices see the same thing. This is where Supabase Realtime carries most of the weight.

**Phase 3 — Public QR page.** Now that the live data is in the cloud, the congregant-facing page is just a different view of the same stream. Bookmarks, translations, email bundle come in here.

Each phase is independently useful. You can even pause after Phase 1 if it turns out that's all churches actually want.

---

## Where we stopped

The conversation ended with me offering four next steps and the user instead asking to save this for later. The open offers were:

- (a) Sketch the Supabase schema (tables, relationships) for this.
- (b) Write out what the Electron-side `CloudSync` abstraction looks like so you can drop it in without rewriting existing code.
- (c) Walk through the auth flow in detail (how does the Electron app log in, store tokens, handle expiry).
- (d) Talk through the business-model questions first.

When you come back to this, pick one of those or answer the 6 questions in "The questions that actually matter" section above and I'll tighten into an actual plan.
