import { createPersistentRun, RUN_KEY } from '../lib/persistentRun';
import { useNotificationStore } from './notificationStore';

// Keep the session through renderer hot reloads as well as React remounts.
const session = globalThis as typeof globalThis & { __trilorahRun?: ReturnType<typeof createPersistentRun>; __trilorahRunVersion?: number };
if (session.__trilorahRunVersion !== 3) session.__trilorahRun = undefined;
session.__trilorahRunVersion = 3;
export const operatorRunStore = session.__trilorahRun ??= createPersistentRun({
  onSaveError: source => useNotificationStore.getState().receive({ id: source === 'durable' ? 'operation:set-setting:operatorRunV1' : 'run-save:local', title: 'Service changes could not be saved', detail: 'The current service is still in memory. Save a service package before closing the app, and check the available storage.', severity: 'error', target: 'run' }),
  onSaveSuccess: source => useNotificationStore.getState().resolve(source === 'durable' ? 'operation:set-setting:operatorRunV1' : 'run-save:local', 'Service changes have been saved again.'),
  read: () => JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null'),
  write: run => localStorage.setItem(RUN_KEY, JSON.stringify(run)),
  readDurable: () => window.api?.getSetting('operatorRunV1') ?? Promise.resolve(null),
  writeDurable: run => window.api?.setSetting('operatorRunV1', run) ?? Promise.resolve(),
});
if (typeof window !== 'undefined') {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== RUN_KEY || !event.newValue) return;
    try { operatorRunStore.acceptExternal(JSON.parse(event.newValue)); } catch { /* Ignore malformed external storage. */ }
  };
  window.addEventListener('storage', onStorage);
  import.meta.hot?.dispose(() => window.removeEventListener('storage', onStorage));
}
