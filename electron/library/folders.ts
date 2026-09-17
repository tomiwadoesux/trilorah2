/**
 * Folders for a library (presentations, songs, media).
 *
 * The folder index is a thin overlay: it never owns the items, only a
 * one-folder-per-item mapping and the folder records themselves. Deleting
 * a folder never deletes items — they fall back to unfoldered. Persisted
 * to <storageDir>/library-folders/<libraryId>.json.
 */
import fs from 'node:fs'
import path from 'node:path'

export type LibraryId = 'presentations' | 'songs' | 'media'

export interface Folder {
  id: string
  name: string
  color?: string
  order: number
  createdAt: number
}

interface FolderFile {
  version: 1
  folders: Folder[]
  items: Record<string, string>
}

export interface FolderStats {
  folderId: string | null
  name: string
  count: number
}

export class FolderIndex {
  private folders: Folder[] = []
  private items: Record<string, string> = {}
  private readonly file: string

  constructor(
    storageDir: string,
    readonly libraryId: LibraryId,
    private readonly now: () => number = () => Date.now(),
    private readonly makeId: () => string = defaultId
  ) {
    this.file = path.join(storageDir, 'library-folders', `${libraryId}.json`)
    this.load()
  }

  // ----------------------------------------------------------- persistence

  private load(): void {
    try {
      if (!fs.existsSync(this.file)) return
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Partial<FolderFile>
      this.folders = Array.isArray(raw.folders) ? raw.folders.filter(isFolder) : []
      this.items = raw.items && typeof raw.items === 'object' ? { ...raw.items } : {}
      const known = new Set(this.folders.map((f) => f.id))
      for (const [item, folder] of Object.entries(this.items)) {
        if (!known.has(folder)) delete this.items[item]
      }
      this.normaliseOrder()
    } catch {
      this.folders = []
      this.items = {}
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const data: FolderFile = { version: 1, folders: this.folders, items: this.items }
    const tmp = `${this.file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
    fs.renameSync(tmp, this.file)
  }

  private normaliseOrder(): void {
    this.folders.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
    this.folders.forEach((f, i) => { f.order = i })
  }

  private find(id: string): Folder {
    const f = this.folders.find((x) => x.id === id)
    if (!f) throw new Error(`Folder not found: ${id}`)
    return f
  }

  // ------------------------------------------------------------- folders

  createFolder(name: string, color?: string): Folder {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Folder name is required')
    const folder: Folder = {
      id: this.makeId(),
      name: trimmed,
      order: this.folders.length,
      createdAt: this.now()
    }
    if (color) folder.color = color
    this.folders.push(folder)
    this.save()
    return { ...folder }
  }

  renameFolder(id: string, name: string): Folder {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Folder name is required')
    const f = this.find(id)
    f.name = trimmed
    this.save()
    return { ...f }
  }

  setColor(id: string, color: string | null): Folder {
    const f = this.find(id)
    if (color) f.color = color
    else delete f.color
    this.save()
    return { ...f }
  }

  /** Removes the folder; its items become unfoldered. Items are never deleted. */
  deleteFolder(id: string): void {
    const idx = this.folders.findIndex((x) => x.id === id)
    if (idx < 0) return
    this.folders.splice(idx, 1)
    for (const [item, folder] of Object.entries(this.items)) {
      if (folder === id) delete this.items[item]
    }
    this.normaliseOrder()
    this.save()
  }

  reorderFolders(ids: string[]): Folder[] {
    const byId = new Map(this.folders.map((f) => [f.id, f]))
    const seen = new Set<string>()
    const next: Folder[] = []
    for (const id of ids) {
      const f = byId.get(id)
      if (f && !seen.has(id)) {
        next.push(f)
        seen.add(id)
      }
    }
    // Any folder not mentioned keeps its relative order at the end.
    for (const f of this.folders) if (!seen.has(f.id)) next.push(f)
    next.forEach((f, i) => { f.order = i })
    this.folders = next
    this.save()
    return this.listFolders()
  }

  listFolders(): Folder[] {
    return this.folders.map((f) => ({ ...f }))
  }

  // --------------------------------------------------------------- items

  moveItem(itemId: string, folderId: string | null): void {
    if (folderId === null) {
      if (itemId in this.items) {
        delete this.items[itemId]
        this.save()
      }
      return
    }
    this.find(folderId)
    if (this.items[itemId] === folderId) return
    this.items[itemId] = folderId
    this.save()
  }

  folderOf(itemId: string): string | null {
    return this.items[itemId] ?? null
  }

  itemsIn(folderId: string, allItemIds: readonly string[]): string[] {
    return allItemIds.filter((id) => this.items[id] === folderId)
  }

  unfoldered(allItemIds: readonly string[]): string[] {
    return allItemIds.filter((id) => !(id in this.items))
  }

  /** Drop mappings for items that no longer exist. Returns how many were removed. */
  strip(existingItemIds: readonly string[]): number {
    const keep = new Set(existingItemIds)
    let removed = 0
    for (const item of Object.keys(this.items)) {
      if (!keep.has(item)) {
        delete this.items[item]
        removed++
      }
    }
    if (removed) this.save()
    return removed
  }

  /** Counts per folder, in folder order, plus a trailing entry for unfoldered items. */
  stats(allItemIds: readonly string[]): FolderStats[] {
    const counts = new Map<string, number>()
    let loose = 0
    for (const id of allItemIds) {
      const f = this.items[id]
      if (f && counts.has(f)) counts.set(f, (counts.get(f) as number) + 1)
      else if (f && this.folders.some((x) => x.id === f)) counts.set(f, 1)
      else loose++
    }
    const out: FolderStats[] = this.folders.map((f) => ({ folderId: f.id, name: f.name, count: counts.get(f.id) ?? 0 }))
    out.push({ folderId: null, name: 'Unfoldered', count: loose })
    return out
  }
}

function isFolder(x: unknown): x is Folder {
  return !!x && typeof x === 'object' && typeof (x as Folder).id === 'string' && typeof (x as Folder).name === 'string'
}

function defaultId(): string {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
