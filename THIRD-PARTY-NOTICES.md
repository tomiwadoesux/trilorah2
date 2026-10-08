# Third-party notices

## Solar icon artwork

This application uses the Bold (filled) style of **Solar**, created by
**480 Design**, through `@solar-icons/react`.

- Original artwork: https://www.figma.com/community/file/1166831539721848736
- React package: https://github.com/saoudi-h/solar-icons
- Artwork license: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)

The artwork is resized and colored to match controls. The path geometry is
unchanged. Visible attribution is included in the desktop Settings, companion
Give tab, and web dashboard.

## @solar-icons/react code

MIT License

Copyright (c) 2024 Hakim Saoudi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

The Software may include icons that are licensed under the Creative Commons
Attribution 4.0 International License (CC BY 4.0). Commercial use is allowed,
but attribution is required for the use of these icons. See LICENSE-THIRD-PARTY
for more details.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## Bible translations in bible.db

Every translation bundled in `bible.db` is public domain. Where each came from,
when it was fetched and a SHA-256 of its rows are recorded in
`electron/data/bible-sources.json` (WEB, BSB, ASV) and
`electron/data/kjv-source.json` (KJV).

- **Berean Standard Bible (BSB)** — dedicated to the public domain on
  30 April 2023; "all uses are freely permitted" (https://berean.bible/terms.htm).
  The Holy Bible, Berean Standard Bible, BSB is produced in cooperation with
  Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible Translation
  Committee. This text of God's Word has been dedicated to the public domain.
- **American Standard Version (1901)** — public domain
  (https://ebible.org/Scriptures/details.php?id=eng-asv).
- **World English Bible** — public domain (https://worldenglish.bible/).
- **King James Version (1769)** — public domain outside the United Kingdom.

Fetched through bible.helloao.org (eBible's own API) by
`scripts/build-bible-db.mjs`. Licensed translations (NKJV, NIV, ESV, NLT, NASB,
AMP) are not bundled.

## Licensed translations through YouVersion

NKJV, NIV and any other Bible the build's app key is licensed for are read
from the YouVersion Platform API (https://developers.youversion.com), free for
non-commercial apps under the YouVersion Platform Terms of Use. Their text is
never bundled: a chapter is fetched when it is first needed and kept on the
church's computer (`userData/bibles/online-cache.db`) for at most 30 days and
120 chapters per version, and is deleted at once if the key is refused or a
version is no longer licensed. Each version's own copyright line, as YouVersion
supplies it, is shown under its text in the scripture library, and its initials
follow every quotation on the projector. Code: `electron/data/bibleOnline/`.
