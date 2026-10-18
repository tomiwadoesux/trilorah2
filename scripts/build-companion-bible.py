"""Export the audited, public-domain WEB corpus for the congregation reader.

Run from the repository root after rebuilding bible.db. One request loads one
book, so the phone never downloads the whole Bible to read a single passage.
"""
import json
import pathlib
import re
import sqlite3

root = pathlib.Path(__file__).resolve().parent.parent
db = sqlite3.connect(f"file:{root / 'bible.db'}?mode=ro", uri=True)
source = (root / 'electron/data/books.ts').read_text().split('export const bookNames')[0]
names = re.findall(r"^  '?([^':]+)'?: (\d+),?$", source, re.M)
out = root / 'web/public/bible/web'
out.mkdir(parents=True, exist_ok=True)
books = []
total = 0
for name, raw_id in names:
    book_id = int(raw_id)
    chapters = {}
    for chapter, verse, text in db.execute('SELECT Chapter, Versecount, verse FROM bible WHERE Version = ? AND Book = ? ORDER BY Chapter, Versecount', ('WEB', book_id)):
        chapters.setdefault(str(chapter), []).append({'number': verse, 'text': text})
        total += 1
    assert chapters, name
    books.append({'id': book_id, 'name': name, 'chapters': len(chapters)})
    (out / f'{book_id}.json').write_text(json.dumps(chapters, ensure_ascii=False, separators=(',', ':')) + '\n')
assert len(books) == 66 and total == 31098, (len(books), total)
(root / 'web/src/lib/companionBibleBooks.json').write_text(json.dumps(books, indent=2) + '\n')
source = json.loads((root / 'electron/data/bible-sources.json').read_text())['versions']['WEB']
(out / 'source.json').write_text(json.dumps({'version': 'WEB', **source}, indent=2) + '\n')
print(f'Exported {total} WEB verses in {len(books)} books.')
