export type GuidePrerequisite = 'stock' | 'bible';
export type GuideReadiness = 'ready' | 'missing-stock' | 'missing-bible' | 'desktop' | 'unknown';
type StatusApi = {
  getStockProviders?: () => Promise<readonly string[]>;
  getDbStatus?: () => Promise<{ connected: boolean }>;
};
/** Read availability only. Never retrieve credentials, transcripts or media. */
export async function guideReadiness(kind: GuidePrerequisite, api: StatusApi | undefined): Promise<GuideReadiness> {
  try {
    if (kind === 'stock') {
      if (!api?.getStockProviders) return 'desktop';
      return (await api.getStockProviders()).length ? 'ready' : 'missing-stock';
    }
    if (!api?.getDbStatus) return 'desktop';
    return (await api.getDbStatus()).connected ? 'ready' : 'missing-bible';
  } catch { return 'unknown'; }
}
