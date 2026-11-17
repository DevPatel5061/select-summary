// Real Chrome practice sessions. IDs are temporary and never sent to Google.
// A single queue prevents initial tab creation from racing the extra-tab guard.
export const PRACTICE_URLS = Object.freeze([
  'https://www.geeksforgeeks.org/dsa/hash-table-data-structure/',
  'https://en.wikipedia.org/wiki/Toronto'
]);

export function createPracticeSessions() {
  const storage = chrome.storage.session;
  let queue = Promise.resolve();
  function serial(operation) {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  }
  async function end(reason = '') {
    await storage.remove('practiceSession');
    await storage.set({ practiceStatus: reason });
  }
  async function read() {
    const { practiceSession: session } = await storage.get('practiceSession');
    if (!session) return null;
    // A worker terminated halfway through setup must never police unknown tabs.
    if (session.phase !== 'active') {
      await end('Practice setup was interrupted. You can start again.');
      return null;
    }
    try {
      const tabs = await Promise.all(session.tabIds.map((id) => chrome.tabs.get(id)));
      if (tabs.some((tab) => tab.windowId !== session.windowId)) throw new Error();
      return session;
    } catch {
      await end('Practice ended because a practice tab was moved or closed.');
      return null;
    }
  }
  async function start(guideId) {
    const existing = await read();
    if (existing) {
      if (existing.guideId !== guideId)
        throw new Error('Practice is already open in another welcome tab.');
      await chrome.windows.update(existing.windowId, { focused: true });
      await chrome.tabs.update(existing.articleIds[0], { active: true });
      return existing;
    }
    const guide = await chrome.tabs.get(guideId);
    if (guide.url?.split(/[?#]/)[0] !== chrome.runtime.getURL('welcome.html'))
      throw new Error('Open practice from the welcome tab.');
    let session;
    try {
      const window = await chrome.windows.create({
        tabId: guideId,
        type: 'normal',
        focused: true,
        width: 1280,
        height: 900
      });
      session = {
        id: crypto.randomUUID(),
        phase: 'initializing',
        windowId: window.id,
        guideId,
        tabIds: [guideId],
        articleIds: []
      };
      await storage.set({ practiceSession: session, practiceStatus: '' });
      for (const url of PRACTICE_URLS) {
        const tab = await chrome.tabs.create({ windowId: window.id, url, active: false });
        session.tabIds.push(tab.id);
        session.articleIds.push(tab.id);
        await storage.set({ practiceSession: session });
      }
      session.phase = 'active';
      await storage.set({ practiceSession: session });
      await chrome.tabs.update(session.articleIds[0], { active: true });
      return session;
    } catch {
      await end('Could not finish opening practice. Existing tabs were left untouched.');
      throw new Error('Could not open the practice window. Please try again.');
    }
  }

  chrome.tabs.onCreated.addListener((tab) => {
    void serial(async () => {
      const session = await read();
      if (
        !session ||
        tab.windowId !== session.windowId ||
        session.tabIds.includes(tab.id)
      )
        return;
      // Closing is limited to a newly created tab in our own practice window.
      // Existing tabs dragged in are handled separately and are never closed.
      const current = await chrome.tabs.get(tab.id).catch(() => null);
      if (!current || current.windowId !== session.windowId) return;
      await chrome.tabs.remove(tab.id).catch(() => {});
      await storage.set({
        practiceStatus:
          'Extra tabs close during practice. Choose Exit practice to browse freely.'
      });
    }).catch(() => {});
  });
  chrome.tabs.onAttached.addListener((id, info) => {
    void serial(async () => {
      const session = await read();
      if (
        session &&
        info.newWindowId === session.windowId &&
        !session.tabIds.includes(id)
      )
        await end('Practice restrictions ended to preserve the tab you moved here.');
    }).catch(() => {});
  });
  chrome.tabs.onDetached.addListener((id, info) => {
    void serial(async () => {
      const session = await read();
      if (session && info.oldWindowId === session.windowId && session.tabIds.includes(id))
        await end('Practice ended because a practice tab was moved.');
    }).catch(() => {});
  });
  chrome.tabs.onUpdated.addListener((id, change) => {
    if (change.status !== 'complete') return;
    void serial(async () => {
      const session = await read();
      if (!session || id !== session.guideId) return;
      const guide = await chrome.tabs.get(id).catch(() => null);
      // Our own extension URL is readable without tabs permission. An unknown
      // or different URL releases the guard instead of stranding its Exit UI.
      if (guide?.url?.split(/[?#]/)[0] !== chrome.runtime.getURL('welcome.html'))
        await end('Practice restrictions ended because the guide was left.');
    }).catch(() => {});
  });
  chrome.tabs.onRemoved.addListener((id) => {
    void serial(async () => {
      const session = await read();
      if (session?.tabIds.includes(id))
        await end('Practice ended because a practice tab was closed.');
    }).catch(() => {});
  });
  chrome.windows.onRemoved.addListener((id) => {
    void serial(async () => {
      const session = await read();
      if (session?.windowId === id) await end();
    }).catch(() => {});
  });

  return {
    start: (guideId) => serial(() => start(guideId)),
    end: () => serial(() => end()),
    match: (tabId) =>
      serial(async () => {
        const session = await read();
        return session?.articleIds.includes(tabId) ? session.id : null;
      }),
    status: () =>
      serial(async () => {
        const session = await read();
        const { practiceStatus = '' } = await storage.get('practiceStatus');
        return {
          active: Boolean(session),
          guideId: session?.guideId,
          windowId: session?.windowId,
          message: practiceStatus
        };
      })
  };
}
