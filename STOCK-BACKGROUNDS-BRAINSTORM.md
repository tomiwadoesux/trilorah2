# Stock Backgrounds (Image Search) — Brainstorm

Saved for later. Design conversation, not a plan. Pick up from here.

---

## Round 1 — User's original question

> where can i get free stock images api, like plug it in this app so they can search in the app for themes for the background

---

## Round 1 — Response

### Options

**Pexels API** — recommended
- Free, 200 req/hr, 20k/month, **no attribution required** (credit appreciated)
- Photos **and videos** in one API — motion backgrounds for worship
- Commercial use allowed, including in a paid app
- `GET https://api.pexels.com/v1/search?query=mountain+sunrise&orientation=landscape&per_page=30` with `Authorization: <key>`

**Unsplash API**
- Best-looking, curated library
- Demo tier 50 req/hr; production needs manual approval
- Requires attribution + a "download trigger" ping per download
- No video

**Pixabay API**
- 100 req/min, photos + video + illustrations, no attribution
- Quality uneven — lots of clip-art among the gems

**Openverse** — CC search, no key. Fallback only; licences vary per image, must surface attribution.

### What to build

- Pexels primary, Pixabay fallback, behind one `imageSearch` module in Electron main (key never in renderer JS)
- **Theme presets** instead of raw search — preachers think in themes, not stock keywords
- **Auto-suggest from the sermon** — pull imagery from the scripture reference / notes and pre-run the search ("intelligent")
- **Cache downloads locally** into the sermon folder — projector must never depend on church-basement wifi
- **Dark scrim + text-safe zones** on selection
- Caveat: "Jesus"/"cross" searches return kitsch; presets filter that, plus ship a small hand-curated bundled set for free-tier/offline

---

## Round 2 — User

> think of more theme presets. what if i have like 3 accounts for each so they fall back on themselves? the req per minute — this is a worldwide scripture app, those reqs are small. where can i really get one for commercial use (will use these for now)? this app is free, no subscription.

---

## Round 2 — Response

### 3 accounts — don't
Pexels/Pixabay/Unsplash ToS: one key per application. Rotating keys to dodge limits gets the **app** banned, not the account. And it isn't needed — the limit is per key per hour, but the number of *distinct searches* a scripture app makes is tiny. 10,000 churches searching "mountain sunrise" = one API call if cached.

### Architecture that makes the free tier enough

```
Trilorah app ──► tiny proxy (Supabase edge fn / Cloudflare Worker, free tier)
                     │  cache hit? → return stored JSON (99% of traffic)
                     └─ miss → Pexels → store 7 days → return
```

- **Presets are finite.** ~50 presets × 3 pages × weekly refresh ≈ 150 API calls/week worldwide. Free tier is 20k/month.
- **Freeform search** — normalise query (lowercase, trim, sort words), cache 24h. Hit rate is high; preachers search the same ~200 words.
- **Photo bytes** go direct to Pexels CDN (allowed, unlimited) — only *search* calls count.
- **Email Pexels** for a raised limit — they grant it free to legit apps showing "Photos by Pexels". A faith app with a caching proxy is an easy yes.
- **Bundle a curated pack** (~150 hand-picked images in the installer) — covers the offline/free-local goal. Pexels licence allows this redistribution.
- Proxy also keeps the API key off the client (Electron `.env` ships inside the app and anyone can unzip it).

### Commercial-scale sources (later)

| Source | Scale | Catch |
|---|---|---|
| **Pexels (raised limit)** | effectively unlimited | ask + attribution — best fit |
| **Wikimedia Commons API** | no key, huge, no real rate limit | per-image attribution, uneven quality, licence filter needed |
| **Openverse (registered)** | 10k/day, aggregates Flickr/Wikimedia | mixed licences |
| **Cloudflare R2 + own curated library** | free egress, unlimited | you curate — what ProPresenter-style apps actually do |
| Unsplash / Getty / Shutterstock | commercial tiers | paid; no fit for a no-subscription app |

Long-term combo: bundled pack → Pexels (cached, raised) → Wikimedia for the deep tail.

### Theme presets (grouped how a preacher thinks; each maps to a tuned query)

**Creation** — Light · Dawn · Night Sky / Stars · Mountains · Ocean · River · Forest · Desert / Wilderness · Fields · Harvest · Rain · Storm · Fire · Snow · Rainbow · Rock

**Scripture imagery** — Cross · Open Bible · Candle / Lamp · Bread & Wine · Crown · Shepherd & Sheep · Dove · Path / Road · Door / Gate · Anchor · Vine & Branches · Seed & Soil · Potter's Clay · Living Water / Baptism · Boat & Nets · Armor · Lion · Eagle · Olive Tree · Wheat & Tares · Empty Tomb

**Church calendar** — Advent · Christmas · Epiphany · Lent · Palm Sunday · Good Friday · Easter · Pentecost · Thanksgiving · New Year

**Worship & people** — Raised Hands · Prayer · Congregation · Children · Hands Together / Unity · Nations / Globe · City Lights · Family · Generations

**Mood / abstract** (text-safe, most used in practice) — Gold Bokeh · Dark Texture · Marble · Ink & Water · Soft Gradient · Smoke · Stained Glass · Linen / Paper · Geometric

Defaults: dark scrim on every pick; scripture reference auto-picks the group (Psalm 23 → Shepherd, John 15 → Vine, Acts 2 → Pentecost).

### Built 2026-09-03 (v1, direct-from-app)
- `electron/media/stockImages.ts` — Pixabay + Pexels providers behind one shape, 7-day on-disk search cache (`userData/stock-cache`), download into `userData/backgrounds` (same folder as the native picker). Returns `url` (file://) and `src` (local-media://).
- IPC: `get-stock-providers`, `search-stock`, `download-stock`; preload `getStockProviders / searchStock / downloadStock`.
- Keys: `PIXABAY_API_KEY` / `PEXELS_API_KEY` in `.env.local`, mirrored to settings (`pixabayApiKey`, `pexelsApiKey`) like the Deepgram key. Pexels is preferred automatically the moment its key exists.
- UI: media tab → third shelf **search** (`src/design/screens/stockSearch.tsx`), presets in `src/lib/stockPresets.ts`, background library moved to `src/design/screens/mediaLibrary.ts` so a pick lands on the local shelf and in the theme preview.
- `local-media` protocol now registered before the DESIGN_MODE branch so the sandbox can render downloaded files.

### Still to do
- Proxy + shared cache once Supabase is back (move the cache logic server-side; app code stays).
- Email Pexels for a raised limit; bundle the curated offline pack.
- Scripture reference → preset auto-pick.
- Video backgrounds play on the projector (downloaded and previewed by poster today; output window doesn't render mp4 yet).
