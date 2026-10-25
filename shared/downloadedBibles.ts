/** Editions downloaded into bible.db by the Bible builder. */
export const DOWNLOADED_BIBLES = {
  NKJV: {
    name: 'New King James Version',
    attribution: 'New King James Version © 1982 Thomas Nelson. All rights reserved. Text from SABDA.',
  },
  NLT: {
    name: 'New Living Translation (1996)',
    attribution: 'Holy Bible, New Living Translation © 1996 Tyndale Charitable Trust. All rights reserved. Text from SABDA.',
  },
} as const

export type DownloadedBibleCode = keyof typeof DOWNLOADED_BIBLES
