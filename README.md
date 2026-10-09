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

**Trilorah Cutout** is the UI icon family: 91 original drawings on a 32 × 32
grid, with named parts and animation pivots. Desktop, web companion, and phone
remote share the geometry in `shared/cutout/`. Use the existing exports from
`src/ui` or `web/src/components/icons.tsx`; icons inherit `currentColor` and
stay still unless motion is explicitly enabled.

Browse `design.html?cutout-library` for every icon, actual-size samples, motion
previews, and individual downloads. Follow [the icon creation guide](docs/CUTOUT-ICONS.md)
to add a matching drawing, then run `npm run icons:build` to regenerate the SVG
bundle, parts manifest, sprite, and phone templates. Keep brand marks, real QR
codes, charts, and content illustrations as their own assets.

Historical third-party icon notices remain in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

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

## Portable service files (.tri)

Use **.tri** beside **Run of service** in the desktop app for New, Open, Save,
Save As, recent files, and selective resource import/export. Files default to
`Documents/Trilorah/Services`. Once a service is saved, run and layout changes
are saved automatically; the existing local recovery copy is retained.

A package can carry the service, song lyrics, images/videos, presentations,
full theme layouts, church information, saved tools, service records, library
folders, and selected pastor profiles with their actual learning evidence.
**Export pastor & learning** makes a package for a visiting preacher. No voice
recordings, account credentials, API keys, or device pairings are collected.

Import previews let you choose categories or individual items. Required media
and song dependencies are included automatically. Resources and pastors are
imported as new copies, preserving existing library entries; a pastor's
correction samples, aliases, teaching and verified service records remain
together. Automatic projection stays off for the imported profile. Imported
themes are staged for the next Go Live. Selecting only part of a service
package requires saving to a new file, preserving the complete original.

Version 1 is a ZIP with `manifest.json` and SHA-256-addressed assets. Real local
media is embedded and copied into managed storage on import, so the original
laptop/USB is no longer required. Remote links remain links and are reported.
Missing local media stops the save with an error. Limits are 2 GiB per package,
1 GiB per asset, and 16 MiB for the manifest; saves replace the destination only
after a complete temporary archive has been written.

Use **.tri → Import from another app** to bring in EasyWorship songs and packed
media, ProPresenter text presentations/bundles/playlists, or PewBeam theme
properties and transcript exports. Review the supported items and conversion
notes before importing. Lyrics remain editable; included media is copied into
managed storage. The original exports are never modified.

EasyWorship schedule order and layouts, ProPresenter effects/automation, and
advanced PewBeam theme properties are not converted. OpenLP and FreeShow native
importers are not included. See [FOREIGN-IMPORT.md](FOREIGN-IMPORT.md) for supported
inputs, exact limitations, and verification; broader format research remains in
[TRI-FORMAT-RESEARCH.md](TRI-FORMAT-RESEARCH.md).

Validation: `npm run build`, `npm test -- --configLoader runner`, and
`npx electron scripts/tri-package-smoke.cjs` (after building). The desktop smoke
test uses an isolated temporary profile and exercises source-independent
media, song links, preacher learning, layout restoration, and autosave.
Foreign import checks: `node scripts/foreign-import-smoke.cjs` exercises the
desktop SQLite runtime; `npx electron scripts/foreign-import-ui-smoke.cjs`
exercises the actual import screens and portable save after building.

## Provenance

The original TypeScript source was lost (empty dirs, no git history).
This tree was reconstructed 2026-07-12 from the surviving **unminified**
`dist-electron/main.js` bundle — original names, comments, and logs
preserved — then extended with the agentic feature set. The lost Python
`ml/` resolver was rewritten in TypeScript (`electron/engine/referenceResolver.ts`).
# trilorah2
