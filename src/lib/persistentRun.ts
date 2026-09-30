import type { PersistedRun, RunSegment } from '../../shared/operatorRun';
export const RUN_KEY = 'trilorah.run.v1';
export function validRun(value: unknown): value is RunSegment[] {
  return Array.isArray(value) && value.every(s => s && typeof s.key === 'string' && typeof s.type === 'string' && typeof s.label === 'string' && Array.isArray(s.items));
}
function savedRun(value: unknown): PersistedRun | null {
  // Migrate the original array without losing its queued items.
  if (validRun(value)) return {segments:value,updatedAt:0};
  if (!value || typeof value!=='object') return null;
  const saved=value as PersistedRun;
  return validRun(saved.segments) && Number.isSafeInteger(saved.updatedAt) && saved.updatedAt>=0 ? saved : null;
}
interface Storage {
  read: () => unknown;
  write: (run: PersistedRun) => void;
  readDurable?: () => Promise<unknown>;
  writeDurable?: (run: PersistedRun) => Promise<unknown>;
}
/** Mounts never write. Each mutation saves locally before notifying any screen. */
export function createPersistentRun(storage: Storage) {
  let initial: unknown;
  try { initial = storage.read(); } catch { /* Session state remains available. */ }
  let saved=savedRun(initial);
  let snapshot: RunSegment[] = saved?.segments ?? [];
  let updatedAt=saved?.updatedAt ?? 0;
  let revision = 0;
  let hydration: Promise<void> | undefined;
  let writes = Promise.resolve();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(fn => fn());
  const saveLocal = (next: PersistedRun) => { try { storage.write(next); } catch { /* Keep the current run in memory. */ } };
  const save = () => {
    const next={segments:snapshot,updatedAt};
    saved=next; saveLocal(next);
    if (storage.writeDurable) writes = writes.then(() => storage.writeDurable!(next)).then(() => undefined, () => undefined);
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    update: (change: RunSegment[] | ((previous: RunSegment[]) => RunSegment[])) => {
      const next = typeof change === 'function' ? change(snapshot) : change;
      if (next === snapshot) return;
      snapshot = next; revision++; updatedAt=Math.max(Date.now(),updatedAt+1); save(); notify();
    },
    hydrate: () => hydration ??= (async () => {
      if (!storage.readDurable) return;
      const before = revision;
      try {
        const durable = savedRun(await storage.readDurable());
        if (revision !== before) return; // A late reply cannot replace current edits.
        if (durable && (!saved || durable.updatedAt>updatedAt)) {
          snapshot=durable.segments; updatedAt=durable.updatedAt; saved=durable;
          saveLocal(durable); notify();
        } else if (saved) save(); // The local copy may be newer after a restart or interrupted IPC write.
      } catch { /* The local copy survives engine failures. */ }
    })(),
    acceptExternal: (value: unknown) => {
      const incoming=savedRun(value);
      if (!incoming || incoming.updatedAt<updatedAt) return;
      snapshot=incoming.segments; updatedAt=incoming.updatedAt; saved=incoming; revision++; notify();
    },
    flush: () => writes,
  };
}
