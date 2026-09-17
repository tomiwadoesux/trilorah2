/**
 * Public-domain hymns shipped so the songs library is not empty on first run.
 *
 * COPYRIGHT BASIS — every entry here is public domain on both counts that
 * matter: the text was published before 1929 (so it is out of copyright in
 * the US regardless of authorship) AND every named author of the words we
 * actually ship died before 1926 (so life+70 expired no later than 1996 —
 * decades of margin, not the handful of years a rights-holder would test).
 * The app never fetches, scrapes or bundles lyrics from anywhere else — the
 * only other legal source of words in this product is a file the church
 * imports from its own licensed SongSelect or OpenLyrics export.
 *
 * The rule the comments below have to satisfy, and that store.test.ts
 * enforces mechanically rather than trusting a reader to check: EVERY author
 * named in an entry's `authors` array is also named in that entry's comment
 * with a death year written `Name (d. YYYY)`, and every such year is before
 * 1926. "Published pre-1929" alone does not earn a place here — a 1919 or
 * 1923 text whose author died in the 1930s is US-public-domain but still in
 * copyright across most of life+70 Europe, and this file ships to churches
 * we cannot see. Anything that cannot meet the stricter bar is left out
 * rather than argued for; a church that wants that hymn imports its own copy.
 *
 * Attribute only the authors whose words are in `sections`. Crediting the
 * ancient originator of a hymn whose shipped English is a modern
 * translator's is how a file like this launders a live copyright into
 * looking clear, so an entry either ships the cleared author's text under
 * the cleared author's name or is not here at all.
 *
 * Notably ABSENT, and each one left out on purpose — put none of them back:
 *
 *  - 'Great Is Thy Faithfulness' (Thomas Chisholm, 1923, copyright renewed
 *    1951 by Hope Publishing) is flatly still under copyright, however
 *    hymn-like it looks beside these. The design prototype's placeholder
 *    list had it; this one does not.
 *  - 'Be Thou My Vision'. The Old Irish is ancient, but the English every
 *    church actually sings is Mary Byrne's 1905 translation as versified by
 *    Eleanor Hull, who died in 1935 — life+70 ran only to 2006, and the
 *    shipped words would have been hers, not Forgaill's.
 *  - 'All Creatures of Our God and King'. Francis of Assisi died in 1226,
 *    but the singable English is William Draper's 1919 paraphrase and Draper
 *    died in 1933. US-public-domain on the pre-1929 date alone; not clear
 *    enough elsewhere to ship to a church we cannot see.
 *
 * Both of the last two are hymns a church may well own and is free to import
 * from its own file. That is the difference: we are not judging what they may
 * sing, only what WE are entitled to put on their disk.
 *
 * Each hymn is deliberately short — two or three sections of two lines. The
 * cards these fill are slide previews, not hymnals, and a church that wants
 * the full text imports its own file.
 */
import type { ImportedSong } from './import'

export interface SeedHymn {
  /** Stable key, never reused and never renamed: a deletion is remembered by it. */
  key: string
  song: ImportedSong
}

/**
 * The year an author must have died before for their words to be seeded.
 *
 * 1926 rather than "70 years before today": a constant is auditable and a
 * moving window is not. Every entry clears it by generations, so it never
 * needs bumping — and if a future entry only clears a moving window, that is
 * exactly the entry this file should refuse.
 */
export const SEED_AUTHOR_DIED_BEFORE = 1926

/* eslint-disable no-irregular-whitespace */
export const SEED_HYMNS: readonly SeedHymn[] = [
  {
    // John Newton (d. 1807), published 1779.
    key: 'amazing-grace',
    song: {
      title: 'Amazing Grace',
      authors: ['John Newton'],
      sections: [
        { label: 'Verse 1', lines: ['Amazing grace, how sweet the sound', 'that saved a wretch like me'] },
        { label: 'Verse 2', lines: ['’Twas grace that taught my heart to fear', 'and grace my fears relieved'] },
        { label: 'Verse 3', lines: ['Through many dangers, toils and snares', 'I have already come'] }
      ]
    }
  },
  {
    // Reginald Heber (d. 1826), published 1826.
    key: 'holy-holy-holy',
    song: {
      title: 'Holy, Holy, Holy',
      authors: ['Reginald Heber'],
      sections: [
        { label: 'Verse 1', lines: ['Holy, holy, holy, Lord God Almighty', 'early in the morning our song shall rise to thee'] },
        { label: 'Verse 2', lines: ['All the saints adore thee', 'casting down their golden crowns'] }
      ]
    }
  },
  {
    // Horatio Spafford (d. 1888), published 1876.
    key: 'it-is-well-with-my-soul',
    song: {
      title: 'It Is Well With My Soul',
      authors: ['Horatio Spafford'],
      sections: [
        { label: 'Verse 1', lines: ['When peace like a river attendeth my way', 'when sorrows like sea billows roll'] },
        { label: 'Chorus', lines: ['It is well, it is well', 'with my soul'] }
      ]
    }
  },
  {
    // Robert Robinson (d. 1790), published 1758.
    key: 'come-thou-fount',
    song: {
      title: 'Come Thou Fount',
      authors: ['Robert Robinson'],
      sections: [
        { label: 'Verse 1', lines: ['Come thou fount of every blessing', 'tune my heart to sing thy grace'] },
        { label: 'Verse 2', lines: ['Here I raise mine Ebenezer', 'hither by thy help I’m come'] }
      ]
    }
  },
  {
    // Fanny Crosby (d. 1915), published 1873.
    key: 'blessed-assurance',
    song: {
      title: 'Blessed Assurance',
      authors: ['Fanny Crosby'],
      sections: [
        { label: 'Verse 1', lines: ['Blessed assurance, Jesus is mine', 'O what a foretaste of glory divine'] },
        { label: 'Chorus', lines: ['This is my story, this is my song', 'praising my Saviour all the day long'] }
      ]
    }
  },
  {
    // Augustus Toplady (d. 1778), published 1776.
    key: 'rock-of-ages',
    song: {
      title: 'Rock of Ages',
      authors: ['Augustus Toplady'],
      sections: [
        { label: 'Verse 1', lines: ['Rock of ages, cleft for me', 'let me hide myself in thee'] },
        { label: 'Verse 2', lines: ['Nothing in my hand I bring', 'simply to thy cross I cling'] }
      ]
    }
  },
  {
    // Joseph Scriven (d. 1886), written 1855, published 1865.
    key: 'what-a-friend-we-have-in-jesus',
    song: {
      title: 'What a Friend We Have in Jesus',
      authors: ['Joseph Scriven'],
      sections: [
        { label: 'Verse 1', lines: ['What a friend we have in Jesus', 'all our sins and griefs to bear'] },
        { label: 'Verse 2', lines: ['Have we trials and temptations?', 'Is there trouble anywhere?'] }
      ]
    }
  },
  {
    // Matthew Bridges (d. 1894), published 1851.
    key: 'crown-him-with-many-crowns',
    song: {
      title: 'Crown Him With Many Crowns',
      authors: ['Matthew Bridges'],
      sections: [
        { label: 'Verse 1', lines: ['Crown him with many crowns', 'the Lamb upon his throne'] },
        { label: 'Verse 2', lines: ['Crown him the Lord of love', 'behold his hands and side'] }
      ]
    }
  },
  {
    // Robert Lowry (d. 1899), published 1876.
    key: 'nothing-but-the-blood',
    song: {
      title: 'Nothing But the Blood',
      authors: ['Robert Lowry'],
      sections: [
        { label: 'Verse 1', lines: ['What can wash away my sin?', 'Nothing but the blood of Jesus'] },
        { label: 'Chorus', lines: ['O precious is the flow', 'that makes me white as snow'] }
      ]
    }
  },
  {
    // Fanny Crosby (d. 1915), published 1875.
    key: 'to-god-be-the-glory',
    song: {
      title: 'To God Be the Glory',
      authors: ['Fanny Crosby'],
      sections: [
        { label: 'Verse 1', lines: ['To God be the glory, great things he hath done', 'so loved he the world that he gave us his Son'] },
        { label: 'Chorus', lines: ['Praise the Lord, praise the Lord', 'let the earth hear his voice'] }
      ]
    }
  },
  {
    // Joachim Neander (d. 1680), 1680; Catherine Winkworth (d. 1878) translation 1863.
    key: 'praise-to-the-lord-the-almighty',
    song: {
      title: 'Praise to the Lord, the Almighty',
      authors: ['Joachim Neander', 'Catherine Winkworth'],
      sections: [
        { label: 'Verse 1', lines: ['Praise to the Lord, the Almighty', 'the King of creation'] },
        { label: 'Verse 2', lines: ['Praise to the Lord, who o’er all things', 'so wondrously reigneth'] }
      ]
    }
  },
  {
    // Isaac Watts (d. 1748), published 1707.
    key: 'when-i-survey-the-wondrous-cross',
    song: {
      title: 'When I Survey the Wondrous Cross',
      authors: ['Isaac Watts'],
      sections: [
        { label: 'Verse 1', lines: ['When I survey the wondrous cross', 'on which the Prince of glory died'] },
        { label: 'Verse 2', lines: ['Forbid it, Lord, that I should boast', 'save in the death of Christ my God'] }
      ]
    }
  },
  {
    // Robert Grant (d. 1838), published 1833.
    key: 'o-worship-the-king',
    song: {
      title: 'O Worship the King',
      authors: ['Robert Grant'],
      sections: [
        { label: 'Verse 1', lines: ['O worship the King, all glorious above', 'and gratefully sing his power and his love'] },
        { label: 'Verse 2', lines: ['O tell of his might, O sing of his grace', 'whose robe is the light, whose canopy space'] }
      ]
    }
  }
]
