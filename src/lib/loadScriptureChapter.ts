export type ScriptureChapterLoad =
  | { status: 'idle' | 'empty'; data: ChapterVerse[]; error: null }
  | { status: 'error' | 'no-api'; data: []; error: string };

/** A stalled bridge must offer a way out just like an explicit database error. */
export async function loadScriptureChapter(
  api: Pick<WindowApi, 'getChapter'> | undefined,
  book: number,
  chapter: number,
  version: string,
): Promise<ScriptureChapterLoad> {
  if (!api) return { status: 'no-api', data: [], error: 'The scripture library is only available in the Trilorah desktop app.' };
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      api.getChapter(book, chapter, version),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Scripture loading timed out.')), 15000);
      }),
    ]);
    if (!result?.success) throw new Error(result?.error || 'The scripture database could not load this chapter.');
    const data = result.data ?? [];
    return { status: data.length ? 'idle' : 'empty', data, error: null };
  } catch (error) {
    return {
      status: 'error', data: [],
      error: error instanceof Error && error.message.trim() ? error.message :
        typeof error === 'string' && error.trim() ? error : 'The scripture database could not load this chapter.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
