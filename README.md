# Trilorah — AI Preacher Assistant

Church presentation software with an agentic sermon engine.
**Beautiful, effortless, intelligent.**

While the preacher speaks, the engine transcribes the sermon, detects
scripture references (explicit *and* quoted), follows along as verses are
read, understands service segments, obeys natural voice commands
("…in the King James Version", "I said verse thirty-four"), learns each
preacher over time, and drives the displays — locally, with no operator
required once a preacher reaches auto-mode trust.

## Structure

- `electron/` — the engine (main process): ASR, scripture detection,
  service agent, voice commands, per-preacher correction ledger, notes
  pipeline, OBS/vMix/WebSocket integrations, Supabase sync.
- `src/` — renderer UI (deliberately minimal text-first UI; visual design pass pending).
- `shared/` — cross-cutting types.
- `web/` — Next.js QR companion app (congregation-facing live page).
- `scripts/` — data builders (`bible:build`, `bible:index`).
- `recovery/` — frozen compiled artifacts the source tree was reconstructed
  from after the original source was lost (see git history).

## Icons

Solar **Bold** is the universal UI icon family. Use the shared exports from
`src/ui` for navigation, buttons, menus, and status controls; add new icons to
`src/ui/icons.tsx` using individual `@solar-icons/react/bold/...` imports.
Icons inherit `currentColor`, with size controlled by their surrounding control.
The companion web app uses the same family through `web/src/components/icons.tsx`.
Keep brand marks and content illustrations as their own assets.

Solar artwork is by 480 Design under CC BY 4.0. Settings includes visible
attribution; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for licenses.

## Setup

```bash
npm install
npm run bible:build   # downloads public-domain translations → bible.db
npm run bible:index   # word index for quote matching
npm run dev           # vite + electron dev
```

`.env.local` (never committed): `DEEPGRAM_API_KEY`, `HF_API_TOKEN`,
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.

Free tier runs fully local (whisper ASR + tiny notes model);
Deepgram/HF keys enable the cloud tier.

## Provenance

The original TypeScript source was lost (empty dirs, no git history).
This tree was reconstructed 2026-07-12 from the surviving **unminified**
`dist-electron/main.js` bundle — original names, comments, and logs
preserved — then extended with the agentic feature set. The lost Python
`ml/` resolver was rewritten in TypeScript (`electron/engine/referenceResolver.ts`).
# trilorah2
