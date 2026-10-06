#!/usr/bin/env python3
"""Build the offline recognition corpus from public-domain BSB USFM.

Usage: python3 scripts/build-passage-corpus.py /path/to/engbsb_usfm.zip
Download: https://ebible.org/Scriptures/engbsb_usfm.zip
No runtime download and no generated theological summaries are involved.
"""
import hashlib
import json
import pathlib
import re
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
BOOKS = dict(zip(
    'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(),
    'Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation'.split('|'),
))


def clean(text):
    text = re.sub(r'\\w\s+([^|\\]+)(?:\|[^\\]*)?\\w\*', r'\1', text)
    text = re.sub(r'\\[a-z]+\d*\*?\s*', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def parse_book(raw):
    code = re.search(r'\\id\s+(\w+)', raw).group(1)
    if code not in BOOKS:
        return []
    raw = re.sub(r'\\f\s.*?\\f\*|\\x\s.*?\\x\*', '', raw, flags=re.S)
    raw = re.sub(r'^\\(?:r|d)\s.*$', '', raw, flags=re.M)
    markers = list(re.finditer(r'\\(c|s\d*|v)\s+([^\n]*)', raw))
    chapter, title, sections, current = 0, '', [], None
    for i, marker in enumerate(markers):
        kind, value = marker.groups()
        if kind == 'c':
            chapter, title, current = int(value.strip()), '', None
        elif kind.startswith('s'):
            title, current = clean(value), None
        else:
            verse_match = re.match(r'(\d+)\s*', value)
            if not verse_match or chapter == 0:
                continue
            verse = int(verse_match.group(1))
            end = markers[i + 1].start() if i + 1 < len(markers) else len(raw)
            text = clean(raw[marker.start() + len('\\v ') + verse_match.end():end])
            if not text:
                continue
            if current is None:
                current = {'id': f'BSB:{code}:{chapter}:{verse}', 'book': BOOKS[code],
                           'chapter': chapter, 'verse': verse, 'endVerse': verse,
                           'title': title or f'{BOOKS[code]} {chapter}', 'verses': []}
                sections.append(current)
            current['endVerse'] = verse
            current['verses'].append({'verse': verse, 'text': text})
    return sections


if __name__ == '__main__':
    archive_path = pathlib.Path(sys.argv[1])
    archive = zipfile.ZipFile(archive_path)
    sections = []
    for name in sorted(archive.namelist()):
        if name.endswith('.usfm'):
            sections.extend(parse_book(archive.read(name).decode('utf-8-sig')))
    assert len({section['book'] for section in sections}) == 66
    assert len({section['id'] for section in sections}) == len(sections)
    assert all(section['verses'] for section in sections)
    verse_count = sum(len(section['verses']) for section in sections)
    assert verse_count > 30_000, verse_count
    result = {'schema': 1, 'source': 'Berean Standard Bible via eBible.org',
              'sourceUrl': 'https://ebible.org/Scriptures/engbsb_usfm.zip',
              'licenseUrl': 'https://berean.bible/terms.htm', 'license': 'Public domain',
              'archiveSha256': hashlib.sha256(archive_path.read_bytes()).hexdigest(),
              'sections': sections}
    output = ROOT / 'electron/data/passages/bsb-sections.json'
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'{len(sections)} sections, {verse_count} verses, {output.stat().st_size:,} bytes')
