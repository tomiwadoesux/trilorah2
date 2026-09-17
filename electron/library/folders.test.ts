import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { FolderIndex } from './folders'

let dir: string
let now: number
let seq: number

function make() {
  return new FolderIndex(dir, 'songs', () => now, () => `id${++seq}`)
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folders-test-'))
  now = 1_700_000_000_000
  seq = 0
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('FolderIndex', () => {
  it('creates, renames, colours and lists folders in order', () => {
    const fi = make()
    const a = fi.createFolder('Christmas')
    const b = fi.createFolder('  Easter ', '#f59e0b')
    expect(a).toEqual({ id: 'id1', name: 'Christmas', order: 0, createdAt: now })
    expect(b.color).toBe('#f59e0b')
    expect(b.name).toBe('Easter')
    fi.renameFolder('id1', 'Advent')
    fi.setColor('id1', '#10b981')
    expect(fi.listFolders().map((f) => [f.name, f.color])).toEqual([['Advent', '#10b981'], ['Easter', '#f59e0b']])
    fi.setColor('id1', null)
    expect(fi.listFolders()[0].color).toBeUndefined()
    expect(() => fi.createFolder('   ')).toThrow()
    expect(() => fi.renameFolder('nope', 'x')).toThrow()
  })

  it('persists to <dir>/library-folders/<libraryId>.json', () => {
    make().createFolder('Hymns')
    const file = path.join(dir, 'library-folders', 'songs.json')
    expect(fs.existsSync(file)).toBe(true)
    const fresh = make()
    expect(fresh.listFolders()[0].name).toBe('Hymns')
    fresh.moveItem('s1', 'id1')
    expect(make().folderOf('s1')).toBe('id1')
  })

  it('moves items, one folder per item', () => {
    const fi = make()
    fi.createFolder('A')
    fi.createFolder('B')
    fi.moveItem('s1', 'id1')
    fi.moveItem('s2', 'id1')
    fi.moveItem('s1', 'id2')
    expect(fi.folderOf('s1')).toBe('id2')
    expect(fi.itemsIn('id1', ['s1', 's2', 's3'])).toEqual(['s2'])
    expect(fi.itemsIn('id2', ['s1', 's2', 's3'])).toEqual(['s1'])
    expect(fi.unfoldered(['s1', 's2', 's3'])).toEqual(['s3'])
    fi.moveItem('s1', null)
    expect(fi.folderOf('s1')).toBeNull()
    expect(() => fi.moveItem('s9', 'missing')).toThrow()
  })

  it('deleting a folder unfolders its items and never touches the items', () => {
    const fi = make()
    fi.createFolder('A')
    fi.createFolder('B')
    fi.moveItem('s1', 'id1')
    fi.moveItem('s2', 'id2')
    fi.deleteFolder('id1')
    expect(fi.listFolders().map((f) => [f.id, f.order])).toEqual([['id2', 0]])
    expect(fi.folderOf('s1')).toBeNull()
    expect(fi.folderOf('s2')).toBe('id2')
    expect(fi.unfoldered(['s1', 's2'])).toEqual(['s1'])
    fi.deleteFolder('id1') // idempotent
  })

  it('reorders folders and tolerates partial / unknown ids', () => {
    const fi = make()
    fi.createFolder('A')
    fi.createFolder('B')
    fi.createFolder('C')
    fi.reorderFolders(['id3', 'zzz', 'id1'])
    expect(fi.listFolders().map((f) => f.id)).toEqual(['id3', 'id1', 'id2'])
    expect(fi.listFolders().map((f) => f.order)).toEqual([0, 1, 2])
    expect(make().listFolders().map((f) => f.id)).toEqual(['id3', 'id1', 'id2'])
  })

  it('strips stale mappings', () => {
    const fi = make()
    fi.createFolder('A')
    fi.moveItem('s1', 'id1')
    fi.moveItem('gone', 'id1')
    expect(fi.strip(['s1'])).toBe(1)
    expect(fi.folderOf('gone')).toBeNull()
    expect(fi.strip(['s1'])).toBe(0)
  })

  it('reports counts per folder plus unfoldered', () => {
    const fi = make()
    fi.createFolder('A')
    fi.createFolder('B')
    fi.moveItem('s1', 'id1')
    fi.moveItem('s2', 'id1')
    fi.moveItem('s3', 'id2')
    expect(fi.stats(['s1', 's2', 's3', 's4', 's5'])).toEqual([
      { folderId: 'id1', name: 'A', count: 2 },
      { folderId: 'id2', name: 'B', count: 1 },
      { folderId: null, name: 'Unfoldered', count: 2 }
    ])
  })

  it('drops mappings to unknown folders on load and survives a corrupt file', () => {
    const file = path.join(dir, 'library-folders', 'songs.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ version: 1, folders: [{ id: 'k', name: 'Keep', order: 5, createdAt: 1 }], items: { s1: 'k', s2: 'ghost' } }))
    const fi = make()
    expect(fi.folderOf('s1')).toBe('k')
    expect(fi.folderOf('s2')).toBeNull()
    expect(fi.listFolders()[0].order).toBe(0)
    fs.writeFileSync(file, '{not json')
    expect(make().listFolders()).toEqual([])
  })

  it('keeps libraries separate', () => {
    new FolderIndex(dir, 'media').createFolder('Videos')
    expect(make().listFolders()).toEqual([])
  })
})
