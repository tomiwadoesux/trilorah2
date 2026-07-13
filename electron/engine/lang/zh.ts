import type { LanguagePack } from './types'

/**
 * Chinese (simplified, 和合本 book names) — NO SPACES between words, so
 * this pack uses substring matching and its own numeral converter
 * (references arrive like "约翰福音3章16节" or "约翰福音三章十六节").
 * Psalms citations use 篇 for the chapter (诗篇23篇), others use 章.
 */
export const zh: LanguagePack = {
  code: 'zh',
  label: '中文',
  bookAliases: {
    Genesis: ['创世记', '创世纪'],
    Exodus: ['出埃及记'],
    Leviticus: ['利未记'],
    Numbers: ['民数记'],
    Deuteronomy: ['申命记'],
    Joshua: ['约书亚记'],
    Judges: ['士师记'],
    Ruth: ['路得记'],
    '1 Samuel': ['撒母耳记上'],
    '2 Samuel': ['撒母耳记下'],
    '1 Kings': ['列王纪上'],
    '2 Kings': ['列王纪下'],
    '1 Chronicles': ['历代志上'],
    '2 Chronicles': ['历代志下'],
    Ezra: ['以斯拉记'],
    Nehemiah: ['尼希米记'],
    Esther: ['以斯帖记'],
    Job: ['约伯记'],
    Psalms: ['诗篇'],
    Proverbs: ['箴言'],
    Ecclesiastes: ['传道书'],
    'Song of Solomon': ['雅歌'],
    Isaiah: ['以赛亚书'],
    Jeremiah: ['耶利米书'],
    Lamentations: ['耶利米哀歌'],
    Ezekiel: ['以西结书'],
    Daniel: ['但以理书'],
    Hosea: ['何西阿书'],
    Joel: ['约珥书'],
    Amos: ['阿摩司书'],
    Obadiah: ['俄巴底亚书'],
    Jonah: ['约拿书'],
    Micah: ['弥迦书'],
    Nahum: ['那鸿书'],
    Habakkuk: ['哈巴谷书'],
    Zephaniah: ['西番雅书'],
    Haggai: ['哈该书'],
    Zechariah: ['撒迦利亚书'],
    Malachi: ['玛拉基书'],
    Matthew: ['马太福音'],
    Mark: ['马可福音'],
    Luke: ['路加福音'],
    John: ['约翰福音'],
    Acts: ['使徒行传'],
    Romans: ['罗马书'],
    '1 Corinthians': ['哥林多前书'],
    '2 Corinthians': ['哥林多后书'],
    Galatians: ['加拉太书'],
    Ephesians: ['以弗所书'],
    Philippians: ['腓立比书'],
    Colossians: ['歌罗西书'],
    '1 Thessalonians': ['帖撒罗尼迦前书'],
    '2 Thessalonians': ['帖撒罗尼迦后书'],
    '1 Timothy': ['提摩太前书'],
    '2 Timothy': ['提摩太后书'],
    Titus: ['提多书'],
    Philemon: ['腓利门书'],
    Hebrews: ['希伯来书'],
    James: ['雅各书'],
    '1 Peter': ['彼得前书'],
    '2 Peter': ['彼得后书'],
    '1 John': ['约翰一书'],
    '2 John': ['约翰二书'],
    '3 John': ['约翰三书'],
    Jude: ['犹大书'],
    Revelation: ['启示录']
  },
  numberWords: {},
  numberCompounds: [],
  numberConnectors: [],
  chapterWords: ['章', '篇'],
  verseWords: ['节', '節'],
  rangeWords: ['到', '至'],
  fillers: [],
  matchMode: 'substring',
  commands: {
    versionPhrases: [{ phrases: ['和合本'], code: 'CUV' }],
    iSaidTriggers: ['我说的是'],
    prayerStart: ['让我们祷告', '我们一起祷告', '低头祷告'],
    prayerEnd: ['阿们'],
    dismiss: ['把它拿下来', '可以拿掉了'],
    intentPhrases: ['请翻开圣经', '我们来读', '请打开']
  }
}

/** Convert Chinese numerals (一 十六 三十 一百零五 …) or digits to a number. */
export function chineseNumberValue(s: string): number | null {
  if (/^\d+$/.test(s)) return parseInt(s, 10)
  const DIGITS: Record<string, number> = {
    '〇': 0, '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9
  }
  let total = 0
  let current = 0
  let sawAny = false
  for (const ch of s) {
    if (ch in DIGITS) {
      current = current * 10 + DIGITS[ch]
      sawAny = true
    } else if (ch === '十') {
      total += (current === 0 ? 1 : current) * 10
      current = 0
      sawAny = true
    } else if (ch === '百') {
      total += (current === 0 ? 1 : current) * 100
      current = 0
      sawAny = true
    } else {
      return null
    }
  }
  total += current
  return sawAny ? total : null
}
