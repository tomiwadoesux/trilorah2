# Canonical KJV import

KJV now comes from the explicitly numbered 1769 King James text published by
CrossWire and eBible.org: <https://ebible.org/bible/details.php?id=eng-kjv2006>.
The source archive, date, rights note and checked SHA-256 are recorded in
`kjv-source.json`. This is the existing 66-book KJV canon, not the BSB passage
recognition translation or a switch to the Apocrypha edition.

The previous unnumbered JSON source was assigned references using each verse's
array offset. Missing/extra entries shifted references within several chapters;
for example, “Watch and pray” appeared at Matthew 26:40 instead of 26:41. Importing
USFM `\c` and `\v` identifiers directly fixes that class of error. Strong's
metadata, notes and presentation markers are removed from displayed text.

The importer validates all 66 books, their expected chapter counts, 1,189 total
chapters, 31,102 nonempty verses, uniqueness, contiguous explicit numbering, clean
text, and known regression references before modifying a database. Regression
checks include Matthew 26:40–41, Mark 4:40–41 and John 3:16.

To update only KJV without fetching or changing the other installed translations:

```sh
node scripts/build-bible-db.mjs --version KJV
```

Or use an already downloaded source archive:

```sh
node scripts/build-bible-db.mjs --version KJV --kjv-usfm /path/to/eng-kjv2006_usfm.zip
```

The importer first makes a complete, consistent database backup in the operating
system's temporary directory and prints its path. It then replaces only KJV in a
transaction and rebuilds the existing full-text index inside that transaction.
Failures roll back; other translations, row IDs and user tables are preserved.
An optional `--database /path/to/bible.db` selects another build database.

After a successful import, regenerate recognition data with `npm run bible:index`.
The database and recognition indexes are generated artifacts excluded by Git.

The source-level parser and transaction regression tests run in
`electron/data/kjvSource.test.ts`. When a generated local `bible.db` exists, that
suite also validates its entire KJV corpus. It skips only that integration check
on a clean checkout without the generated database.
