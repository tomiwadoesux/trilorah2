# Run and build Trilorah from source

Use this route when working on the desktop application. Volunteers who want to install and rehearse should start with [Getting started](GETTING-STARTED.md).

Original Trilorah source code is available under [PolyForm Perimeter 1.0.1](../../LICENSE). Read the [licensing scope](../legal/LICENSING.md), respect its permitted-purpose/noncompete conditions and retain required notices when distributing code or builds. Church internal use/customisation is distinct from offering a competing version to others, even free. Third-party material retains its own terms, and valid earlier grants are not revoked. These commands do not establish a supported production hosting arrangement.

## Prerequisites

- Access to the source tree, Git if obtaining it by checkout, and npm.
- A Node.js release compatible with the lockfile and the scripts' `node:sqlite` import. The locked Vite requires Node `^20.19.0 || >=22.12.0`, but the database builders also need `node:sqlite`. Check that module explicitly below; Node 20 alone is insufficient for these scripts. The project does not currently pin one verified contributor Node version.
- Native build tools if npm cannot use a compatible prebuilt module. The app uses `better-sqlite3` and other native runtimes, so the toolchain depends on the target computer. On macOS, this may include Xcode Command Line Tools; on Windows, the C++ build tools and Python required by native dependency tooling.
- Internet for the initial npm install, Bible-data builders and optional model downloads.

From the repository root, check:

```sh
node --version
npm --version
node -e "require('node:sqlite'); console.log('node:sqlite available')"
```

If `node:sqlite` is unavailable, use a compatible newer Node release before running the builders. Do not delete the lockfile to work around an incompatible runtime.

## Install dependencies and prepare data

Run each command from the repository root:

```sh
npm ci
npm run bible:build
npm run bible:index
npm run bible:fts
npm run rebuild
```

`bible:build` downloads the configured Bible sources and creates `bible.db`. It makes many chapter requests and can take time. `bible:index` creates `electron/data/bible_index.json` for quote matching. `bible:fts` adds the keyword-search index; search has a slower fallback without it. Run the index commands after rebuilding Bible data.

`rebuild` rebuilds `better-sqlite3` for Electron. If you receive a `NODE_MODULE_VERSION` or native ABI error after changing Node, Electron or dependencies, rerun that command. The data builders use Node's own SQLite module so they do not depend on the Electron build of `better-sqlite3`.

For local meaning-based allusion retrieval, also run:

```sh
npm run passages:model
```

This downloads and verifies the sentence and reranker models into `data/models/`. The passage corpus and `bsb-vectors.bin` are present in the source tree. Without the required model/vector combination, that retrieval path stays unavailable. Reference detection and the other matching paths are separate.

Only rebuild passage vectors when the corpus or matching model changes:

```sh
npm run passages:vectors
```

See [the passage-corpus notes](../../electron/data/passages/README.md) for provenance and rebuild details.

## Run the desktop development app

```sh
npm run dev
```

Vite starts the renderer and Electron integration defined in `vite.config.ts`. The regular development app uses real application services and saved settings; it is not an isolated demonstration. Check cloud configuration before using real church material.

For UI work that skips the normal service startup:

```sh
npm run design
```

Design mode is useful for interface development; it does not demonstrate that microphone capture, projector output, cloud connections or a packaged release work. Do not use screenshots of fixtures as proof of a completed service workflow.

## Configure only the services you need

The desktop development app reads an uncommitted `.env.local` at the repository root. It can also persist supported provider keys through its settings screens. Never commit credentials or copy real keys into an issue, screenshot or shared example.

| Feature | Current setup boundary |
| --- | --- |
| Manual scripture, local songs, slides and media | Prepare the Bible data and local content; provider API keys are not a general prerequisite for these tasks. |
| Local speech | Select `whisper-local`; it needs a compatible whisper.cpp executable and a local speech model. First use can download missing model data; Windows x64 has a verified-download bootstrap for its runtime. Other missing native speech executables need a compatible build. SoX is optional because window microphone capture is available. |
| Cloud speech | Select `deepgram` and configure its key in **Settings → Audio & speech** or `DEEPGRAM_API_KEY` for development. Without a key, provider selection falls back to local speech. |
| Generated sermon notes / cloud language-model fallback | Requires the current Hugging Face setup (`HF_API_TOKEN` or supported settings). The experimental local notes provider currently delegates generation to cloud, including its fallback; it is not an offline notes implementation. |
| Stock media / video search | Configure the relevant Pixabay, Pexels or YouTube key under **Settings → API keys**. Paste/import paths and individual content sources have their own requirements. |
| Online Bible chapters | NKJV and NLT (1996) are selectable through SABDA, the upstream used by Biblika, without an API key. First reads need internet; loaded chapters are cached for up to 30 days, at most 120 per version. YouVersion supplies additional versions enabled for the build's key. |
| Cloud accounts, shared live services and phone microphone discovery | The desktop contains a cloud client and default endpoint configuration. A source build is not automatically isolated from Trilorah-operated services. Inspect the intended configuration before connecting. Running the desktop does not establish a supported self-hosted backend. |
| Local phone presentation remote | Served by the running desktop over the supported local network, with pairing and desktop approval. It is distinct from the cloud-assisted phone microphone. |

Starting listening can initialise cloud sharing when it is configured, even with local speech selected. Consider the complete workflow when assessing offline behaviour or data handling.

## Check and compile

These scripts are available:

```sh
npm run typecheck
npm test
npm run build
```

`build` performs TypeScript project builds and produces renderer/main/preload output. Tests and successful compilation do not replace a rehearsal with hardware or a packaged-installation test.

After building, the packaged-entry app can be launched using the existing script:

```sh
npm run start
```

## Packaging is a separate step

The project has `npm run dist` and `npm run dist:dir`. Read [electron-builder.yml](../../electron-builder.yml) and [the service-defaults writer](../../scripts/write-service-defaults.mjs) before using either.

The builder currently targets unsigned macOS arm64 DMG/ZIP and Windows x64 NSIS output in `release/`. That target configuration does not certify operating-system support or a working cross-build. Build and test Windows native modules on a compatible Windows build environment before distributing Windows output.

Packaging expects Bible data, quote index, passage vectors, both matching-model directories and `eng.traineddata`. The model-fetch command prepares the matching models. `eng.traineddata` is ignored by Git and is not prepared by a dedicated package script; provide and verify the required English OCR asset before packaging. Development OCR can fetch its own model on first use, but that is not a reproducible release-asset preparation step.

The distribution scripts also write provider defaults from the environment into source files and restore them afterwards. Treat the resulting build as potentially containing those configured credentials. Use a deliberately reviewed release configuration before distributing it; the restore step only clears working-tree defaults and does not remove values from a built artifact. Do not assume an interrupted packaging run restored the working tree.

## About the website and self-hosting

`web/` is a separate Next.js application with its own lockfile. Its existing local commands are:

```sh
cd web
npm ci
npm run dev
```

The configured development port is **3003**. Building and running it locally is distinct from operating account, database, storage and real-time services. This guide does not provide a complete independently verified backend deployment, migration, backup or production configuration. Do not describe the community route as a one-command hosted alternative until that route has been documented and tested.

## Review status and evidence

Reviewed against the October 17, 2026 working tree, version 0.4.8. Commands were checked against [package.json](../../package.json), [package-lock.json](../../package-lock.json), [Vite configuration](../../vite.config.ts) and [web scripts](../../web/package.json). Data preparation was checked against the scripts named above. Runtime conditions were checked in [main startup](../../electron/main.ts), [speech selection](../../electron/asr/provider.ts), [local speech](../../electron/asr/whisperLocal.ts), [offline runtime](../../electron/asr/offlineRuntime.ts), [notes providers](../../electron/llm/notesProvider.ts), [OCR](../../electron/media/ocrProcessor.ts) and [presentation conversion](../../electron/media/pptxConverter.ts).

No dependencies were installed, models downloaded, application started, cloud service changed or installer built in this documentation pass. Contributor Node version, clean-machine builds, target OS requirements, release asset preparation and hardware/provider walkthroughs still need verification.
