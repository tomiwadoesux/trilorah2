/** Portable service/library package contract. No application or device credentials belong here. */
export const TRI_CATEGORIES = ['service', 'songs', 'media', 'presentations', 'themes', 'preachers', 'church', 'tools', 'records', 'folders'] as const
export type TriCategory = typeof TRI_CATEGORIES[number]
export interface TriItem { id: string; label: string; data: any }
export interface TriSnapshot { categories: Partial<Record<TriCategory, TriItem[]>> }
export interface TriAsset { id: string; entry: string; name: string; size: number; sha256: string }
export interface TriManifest extends TriSnapshot {
  format: 'trilorah'
  version: 1
  id: string
  title: string
  createdAt: string
  assets: TriAsset[]
  warnings?: string[]
}
export type TriSelection = Partial<Record<TriCategory, string[]>>
