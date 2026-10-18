export interface ArchiveChunk { id: string; text: string; timestamp: string; offset_ms: number | null }
/** Page until the server returns an empty page, not merely a short page:
 * a project's row cap can be lower than the requested page size. */
export async function loadTranscriptPages<T extends ArchiveChunk>(
  page: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  onProgress?: (count: number) => void,
  signal?: AbortSignal,
): Promise<T[]> {
  const rows = new Map<string, T>();
  let offset = 0;
  while (true) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const { data, error } = await page(offset, offset + 499);
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (error) throw error;
    if (!data?.length) break;
    const before = rows.size;
    for (const row of data) rows.set(row.id, row);
    if (rows.size === before) throw new Error('Transcript pagination did not advance');
    offset += data.length;
    onProgress?.(rows.size);
  }
  return [...rows.values()];
}
export function transcriptText(title: string, chunks: ArchiveChunk[]) {
  return `${title}\n\nPublished transcript · speech recognition may contain errors.\n\n${chunks.map(c => c.text.trim()).filter(Boolean).join('\n\n')}`;
}
