import { guideMapVersion } from './productGuide';

/** Per-church memory of what the Messenger has already taught. Local only; never sent anywhere. */
const key = 'trilorah-messenger';
interface Progress { done: Record<string, string>; seenVersion: string | null; phrase: Record<string, number> }
const empty = (): Progress => ({ done: {}, seenVersion: null, phrase: {} });
export function readProgress(): Progress {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return { done: parsed.done ?? {}, seenVersion: parsed.seenVersion ?? null, phrase: parsed.phrase ?? {} };
  } catch { return empty(); }
}
function write(progress: Progress) { try { localStorage.setItem(key, JSON.stringify(progress)); } catch { /* private window or blocked storage: the Messenger just talks more */ } }
export function markDone(taskId: string) { const progress = readProgress(); progress.done[taskId] = new Date().toISOString(); write(progress); }
export function isDone(taskId: string, progress = readProgress()) { return !!progress.done[taskId]; }
/** Records this map version as seen; returns the version seen before, which decides what counts as new. */
export function noteSeenVersion(): string | null {
  const progress = readProgress();
  const before = progress.seenVersion;
  if (before !== guideMapVersion) { progress.seenVersion = guideMapVersion; write(progress); }
  return before;
}
export function rememberPhrase(stepId: string, phrase: number) { const progress = readProgress(); progress.phrase[stepId] = phrase; write(progress); }
