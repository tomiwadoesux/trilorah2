# Streaming recognition replay

Run from the repository root:

```sh
node --import tsx evals/recognition-replay.ts --strict --repeat 10 --out /tmp/trilorah-recognition-replay.json
npx vitest run electron/engine/recognitionFlow.test.ts
```

The replay loads the full bundled quote index and passage index once. It tests short beginnings, middle/end quotations, insertions, deletions, spelling mistakes, changing interim hypotheses, story paraphrases and unrelated speech. A fresh listening state is used for each case while retaining the loaded indexes. `byChunk` is a zero-based deadline within the supplied transcript chunks; it checks whether a result arrives before the final transcript, without inventing audio timings.

`fixtures.json` contains explicitly **synthetic** scenarios. `public-domain-sermons.json` contains three short, attributed excerpts from published Spurgeon sermons, verified against The Spurgeon Library. Those excerpts are historical sermon **text**, not recordings, ASR results, or a representative sample of contemporary sermons. Their source title, edition year, URL and location are retained in the report. These cases were used while developing the feature and are regression tests, not an independent accuracy benchmark.

The report includes candidate references at each chunk, unexpected first suggestions, misses, whether the first correct result occurred on an interim, and matching CPU time at the 50th and 95th percentile. Startup time is recorded separately. `--strict` fails on misses, late matches or unwanted first suggestions. `--quotes-only` permits running the quote suite independently.

The component integration test combines both real matchers, `SuggestionTracker` and `VerseDelivery`. It checks that a story narrows to a quote under one suggestion ID, repeated finals do not add cards, revised interim text does not accumulate into a fictitious quote, and detected passages remain previews until an operator or paired remote promotes them. It does not launch Electron or test the wiring inside `main.ts`.

## What the timings mean

Matching CPU time excludes microphone capture, speech recognition, network latency, IPC, browser rendering and index startup. It must not be reported as microphone-to-screen latency. The older `evals/harness.ts` likewise times only local resolver execution; its `medianLatencyMs` is not audio latency.

The previous live route exposed interim speech to the transcript but waited for finalized chunks before running quote matching. Deepgram also documents an additional Smart Format wait of up to three seconds for unfinished entities; `no_delay=true` removes that formatting wait. Both can affect how long a heard reference takes to appear. See [Smart Formatting](https://developers.deepgram.com/docs/smart-format) and [Endpointing and Interim Results](https://developers.deepgram.com/docs/understand-endpointing-interim-results/).

The desktop preview listener updates proposals directly on receipt. The paired operator phone originally polled state once a second, adding up to a polling interval plus request time after the desktop received a result. Test desktop and phone separately when measuring improvements.

## Audio and end-to-end validation

The existing `artifacts/preacher-learning/reference.wav` is a locally generated synthetic voice saying “Proverbs chapter three verse five”; its provenance is recorded in `PREACHER-LEARNING-HANDOFF.md`. It is not a real preacher recording. `scripts/preacher-learning-smoke.cjs` can supply this file to Chromium's fake audio capture under an isolated profile; it clears provider credentials and selects local Whisper. Local Whisper currently buffers five seconds of audio, so that test cannot establish Deepgram latency.

A live-provider measurement should use an explicitly supplied or appropriately licensed recording, or a clearly labelled generated-voice fixture, streamed at real-time speed. Do not measure it by uploading the entire recording as fast as possible. Capture these separate events:

1. Audio time of the last word that supplies enough evidence for the expected passage, annotated beforehand.
2. First corresponding ASR interim and finalized result received by the application.
3. Recognition emitted with its suggestion ID.
4. Suggestion rendered in the desktop UI.
5. The same suggestion rendered on the paired phone.

Report evidence-to-desktop and evidence-to-phone delay separately, including p50/p95 across the recording. For actual acoustic latency, a microphone test additionally includes capture and room conditions. Provider transcript-cursor timing is an approximation and should be labelled accordingly; see [Deepgram's measurement guide](https://developers.deepgram.com/docs/measuring-streaming-latency).

Recognition accuracy needs separately labelled, held-out sermon audio with quotations, paraphrases, accent variation, background noise and long sections where no suggestion is expected. Track correct passages, incorrect suggestions per hour, missed passages and time to a useful suggestion. A small text replay passing does not establish those results.

This replay command never starts a microphone, reads credentials or contacts a speech provider.
