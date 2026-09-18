# Resolver evals

Turns "it got 600 in a row" into a measured number. Runs the spoken
scripture-reference resolver (`electron/engine/referenceResolver.ts`) over
transcript fixtures and reports precision, recall, false-positive rate and
median latency — overall, per language, per preacher and per tag — with a
threshold gate for CI.

```
npm run eval            # table to stdout + evals/last-run.json
npm run eval:gate       # same, exit 1 when below evals/thresholds.json
npx tsx evals/run.ts --lang es | --tag range | --id en-001 | --json
npx vitest run evals    # harness unit tests
```

## Fixture format — `evals/fixtures/*.jsonl`

One JSON object per line. All `.jsonl` files in the directory are loaded;
ids must be unique across files.

```json
{
  "id": "en-002",
  "lang": "en",                      // en | es | fr | pt | hi | zh
  "preacher": "pastor-a",            // optional — for per-preacher breakdown
  "tags": ["explicit", "range"],     // optional — for per-tag breakdown
  "chunks": [                        // fed in order to a fresh resolver
    { "text": "turn with me to romans", "isFinal": false },
    { "text": "turn with me to romans chapter eight verse twenty eight", "isFinal": true }
  ],
  "expected": [                      // [] = negative fixture: must detect nothing
    { "book": "Romans", "chapter": 8, "verse": 28, "endVerse": 30 }
  ],
  "known_failure": true,             // optional — see below
  "gateOpen": true                   // optional — open the bare-book gate
}
```

- `book` is the canonical English name from `electron/data/books.ts`
  (`"1 Corinthians"`, `"Psalms"`, `"Song of Solomon"`), for every language.
- `verse: null` means a chapter-only reference; any verse on that chapter
  matches.
- `endVerse` omitted = don't care; `endVerse: null` = must not be a range.
- `known_failure: true` keeps a fixture you believe is correct that the
  resolver currently fails. It is skipped by the metrics/gate but listed in
  the report, and flagged when it starts passing so you can drop the mark.
- The bare-book gate (the intent engine's narrative suppression) is closed
  by default, mirroring "narrative mode": `"Paul wrote to the Romans"` must
  not emit. Set `gateOpen: true` to test bare-mention behaviour.
- The resolver's clock is injected and advanced 400 ms per chunk, so
  dedup and pending-book TTL behave deterministically.

## Scoring

Per fixture, every detection the resolver emits is classified:

| detection                                         | counts as |
|---------------------------------------------------|-----------|
| book + chapter (+ verse, + endVerse when given) equal an expected ref | TP (once per expected ref) |
| strict prefix of an expected ref: bare book, or same book+chapter with no verse yet, or the verse without its range yet | ignored (normal state-machine step) |
| bare `verse N` context update (empty book)        | ignored |
| anything else                                     | FP (once per unique book/chapter/verse/range) |

Expected refs never matched are FN. A fixture **passes** when FP = 0 and
FN = 0.

Aggregate metrics (known failures excluded):

- **precision** = TP / (TP + FP)
- **recall** = TP / (TP + FN)
- **falsePositiveRate** = fixtures with ≥ 1 FP / fixtures (there is no
  detection-level true-negative count, so this is fixture-level)
- **medianLatencyMs** = median wall-clock ms to feed all chunks of a fixture

`evals/last-run.json` holds the full report: buckets, failures with what
was missed/falsely detected, known failures with `nowPassing`, and every
fixture's raw detections.

## Gate — `evals/thresholds.json`

```json
{ "precision": 0.95, "recall": 0.9, "falsePositiveRate": 0.05 }
```

`npm run eval:gate` exits 1 with the violated metrics and failing fixture
ids when the overall bucket falls below any threshold.

## Growing the set from real corrections

`electron/preachers/evalExport.ts` → `exportFixturesFromLedger(ledgerDir,
outFile, { anonymise: true })` converts every correction sample in the
per-preacher ledgers (`heard` → `correctedTo`) into a fixture tagged
`from-correction` + its source, appending to a JSONL file and skipping
pairs already present. Preacher ids are hashed when anonymising.
