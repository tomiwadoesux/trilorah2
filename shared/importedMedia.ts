/*
 * What main hands back for a picture or clip brought in from this laptop
 * (electron/media/mediaImport.ts). Here, import-free, because the renderer
 * and the preload typings read the same shape.
 */

export interface ImportedMedia {
  /** `local:<hash>` — the same picture is the same card, wherever it came from. */
  id: string
  /** file:// — what a setting or a run row stores. */
  url: string
  /** local-media:// — what a window can draw. */
  src: string
  kind: 'photo' | 'video'
  /** The original's name, without its extension: the card's label. */
  name: string
  bytes: number
  /** The bytes were already in the folder — nothing was copied. */
  existed: boolean
}

export interface SkippedMedia {
  /** The original's file name, extension included, as the operator knows it. */
  name: string
  reason: string
}

export interface MediaImportResult {
  items: ImportedMedia[]
  skipped: SkippedMedia[]
}
