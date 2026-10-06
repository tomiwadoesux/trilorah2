# Offline passage recognition corpus

`bsb-sections.json` contains 3,086 editor-headed, chapter-bounded Bible sections
and their 31,085 available verses, covering all 66 books of the Berean Standard
Bible. The fewer-than-KJV verse total reflects the source edition; it is not an
assertion that another translation's verse numbering is wrong. Recognition uses
these references to look up the operator's selected, installed translation.

## Source and reuse

- Publisher: BSB Publishing / Berean Bible Translation Committee.
- Original downloads: <https://berean.bible/downloads.htm>.
- Source archive: <https://ebible.org/Scriptures/engbsb_usfm.zip>.
- Publisher terms: <https://berean.bible/terms.htm> (public domain, all uses permitted).
- Publisher's digital-format project: <https://github.com/BSB-publishing/bsb2usfm>.
- Retrieved: 2026-10-03. Archive SHA-256 is recorded inside the generated JSON.

The section headings and Scripture wording come from the source, not from
AI-generated summaries or copyrighted third-party commentary. USFM footnotes,
cross-references and formatting are removed; sections are split at chapter
boundaries so the app's existing passage preview can safely render each range.
The recognition corpus is a derived index; it is not a replacement Bible
translation or a new edition carrying the Berean name.

Attribution: The Holy Bible, Berean Standard Bible, BSB is produced in cooperation
with Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible Translation
Committee. This text has been dedicated to the public domain.

## Rebuild

Download the public source archive, then run:

```sh
python3 scripts/build-passage-corpus.py /path/to/engbsb_usfm.zip
```

The importer has no network access and writes only the derived corpus. It checks
book coverage, unique IDs and nonempty sections. `passageMatcher.test.ts` checks
the generated content for leaked USFM markup as well as matching behavior.
Runtime uses a bundled static import, so no source website, API token, background
download or cloud model is needed to retrieve passages.

## What matching does and does not establish

`PassageMatcher` builds one shared local inverted index at startup. It ranks
matching words by distinctiveness, expands a small inspectable set of word and
phrase equivalents, tolerates unambiguous one-letter misspellings, and prefers
details occurring near each other in a source passage. Both interim and final
speech can be searched without waiting for silence. Interim revisions replace
each other; a short final-speech context is retained and expires after a gap.

This is **lexical and concept retrieval, not embedding-based semantic search**.
It can identify retellings which share sufficient story details or known concept
equivalents, but it cannot understand every paraphrase or validate arbitrary
subject/object relationships. A few explicit contradictory retellings are
rejected; those guards are not a general reasoning engine. A displayed candidate
must remain operator-controlled. Its score is a retrieval ranking value, never
a measured confidence percentage.

A story is returned as a range unless a distinctive phrase also supports one
particular verse. The stable source section ID allows the UI to update a card as
the passage becomes more specific. There is no automatic live-display action.

The bundled corpus is suitable grounding for a future embedding/reranking stage:
each section has a durable ID, canonical reference, source title and actual Bible
text. Such a stage should be evaluated separately on real sermon recordings;
passing the synthetic regression cases does not establish microphone accuracy.

## Allusion vectors

`bsb-vectors.bin` holds one 384-number vector for each of 14,811 units (three
verses at a time, stepping two, under their section heading), stored as 8-bit
integers. `SemanticMatcher` compares a spoken sentence against them so that a
passage can be found from its meaning when none of its wording is used.

The vectors and the sentence they are compared with must come from the same
model: all-MiniLM-L6-v2 (Apache-2.0), 8-bit ONNX export, run locally through
`onnxruntime-node`. The model is fetched into `data/models/` and is not
committed.

```sh
npm run passages:model     # download and verify the model (about 23 MB)
npm run passages:vectors   # rebuild the vectors (about six minutes)
```

Rebuild the vectors whenever `bsb-sections.json` changes. The app refuses a
vector file whose length does not match the corpus and runs without allusion
matching rather than with wrong references.

Measured on 30 hand-written allusions and 48 sentences that are not Scripture
(2026-10-04): the right chapter was first for 23 and in the first four for 28;
the auto threshold accepted 13, all correct, and none of the 48. Those
sentences were also used to choose the threshold, so this is a regression
check, not an accuracy figure for real sermons.

## Context: names, the sermon passage and the judge (2026-10-05)

`AllusionFinder` wraps the matchers with three things a sentence alone lacks.

- **Who "he" is.** `NameMemory` keeps the Bible names from the last sentence
  that had any (90 seconds) and reads them into a later he/she/they sentence
  that names nobody. Names come from the BSB text itself (`bibleNames.ts`,
  about 1,600), minus everyday words such as "job". Both readings are searched.
- **What is being preached.** `SermonContext` favours the chapters the
  operator put live (the last three, 40 minutes), by 0.1, for the button only.
- **The judge.** ms-marco-MiniLM-L-6-v2 (Apache-2.0, 23 MB) scores the
  sentence against the top passage; above 4.6 the automatic path suggests it.
  It replaced thresholds on the meaning and overlap scores, which remain the
  fallback when the judge model is not installed.

`npm run eval:allusions` reruns the measurements over
`evals/recognition/allusions.json`. On 2026-10-05, button, right chapter first:
he/she sentences with the name said earlier 22 → 26 of 28; allusions inside
the passage on the wall 21 → 25 of 32. Automatic, right/wrong: allusions 19/0
of 30 (thresholds: 13/0), fresh allusions 16/0 of 24 (11/0), he/she with the
name remembered 22/0 of 28; none of 111 non-Scripture sentences suggested;
2 of 192 everyday he/she stories suggested once a Bible name was remembered.
Tried and not adopted: a judge to reorder candidates (no gain across four
models) and larger sentence models (all-mpnet-base 102 vs 101 of 118;
EmbeddingGemma-300m 107 vs 101 at 115 ms a sentence instead of 2).
The sentences are hand-written and typed; see the caveat above.
