import { migrateState } from './core.js';

// Only the worker writes appState. A single queue protects read/modify/write operations.
export function createStore(storage) {
  let queue = Promise.resolve();
  let initialized = false;
  function transaction(transform) {
    const operation = queue.then(async () => {
      if (!initialized) {
        await storage.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
        const existing = await storage.get(['appState', 'geminiApiKey', 'summaries']);
        const migrated = migrateState(existing);
        if (!existing.appState || existing.appState.version !== migrated.version)
          await storage.set({ appState: migrated });
        await storage.remove(['geminiApiKey', 'summaries']);
        initialized = true;
      }
      const { appState } = await storage.get('appState');
      if (!transform) return structuredClone(appState);
      const next = transform(structuredClone(appState));
      await storage.set({ appState: next });
      return structuredClone(next);
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return { read: () => transaction(), update: (transform) => transaction(transform) };
}
