import { initialState } from '../../chrome-extension/core.js';
import { DEMO_ARTICLES } from '../../chrome-extension/demo-articles.js';
import { memoryStorage } from './storage.mjs';
export async function workerFixture() {
  const local = memoryStorage({
    appState: { ...initialState(), key: 'test-key', keyValidated: true }
  });
  const session = memoryStorage();
  const calls = {
    popup: [],
    closed: [],
    created: [],
    metadata: 0,
    provider: 0
  };
  const settings = {
    popupFails: false,
    tabs: [{ id: 7 }, { id: 8 }],
    status: 200,
    delay: null
  };
  const event = () => ({
    listeners: [],
    addListener(fn) {
      this.listeners.push(fn);
    }
  });
  const messages = event();
  globalThis.chrome = {
    storage: { local, session },
    runtime: {
      id: 'test-extension',
      getURL: (page) => `chrome-extension://test-extension/${page}`,
      onInstalled: event(),
      onMessage: messages,
      async getPlatformInfo() {
        calls.metadata++;
        return { os: 'mac' };
      }
    },
    tabs: {
      onRemoved: event(),
      async query() {
        return settings.tabs;
      },
      async update(id) {
        return { id };
      },
      async create() {
        calls.created.push(9);
        return { id: 9 };
      },
      async remove(id) {
        calls.closed.push(id);
      }
    },
    contextMenus: { onClicked: event() },
    commands: {
      onCommand: event(),
      async getAll() {
        calls.metadata++;
        return [{ name: 'summarize-selection', shortcut: 'Alt+Shift+S' }];
      }
    },
    action: {
      async setBadgeText() {},
      async openPopup(options) {
        if (settings.popupFails) throw new Error('Popup unavailable');
        calls.popup.push(options);
      }
    }
  };
  globalThis.fetch = async () => {
    calls.provider++;
    if (settings.delay) await settings.delay;
    return new Response(
      JSON.stringify({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [{ text: 'Toronto is a diverse city on Lake Ontario.' }]
            }
          }
        ]
      }),
      { status: settings.status }
    );
  };
  await import(
    `../../chrome-extension/background.js?fixture=${crypto.randomUUID()}`
  );
  const sender = (tab = 7) => ({
    id: chrome.runtime.id,
    url: chrome.runtime.getURL('welcome.html'),
    tab: { id: tab, windowId: 99 }
  });
  const send = (type, run = 'walkthrough-session-a', fields = {}, tab = 7) =>
    new Promise((resolve) =>
      messages.listeners[0](
        { type, welcomeRunId: run, ...fields },
        sender(tab),
        resolve
      )
    );
  const summary = (run, fields = {}, tab = 7) =>
    send(
      'SUMMARIZE_DEMO',
      run,
      {
        articleId: 'toronto',
        selection: DEMO_ARTICLES.toronto.text,
        requestId: crypto.randomUUID(),
        ...fields
      },
      tab
    );
  return {
    local: local.data,
    session: session.data,
    storage: local,
    settings,
    calls,
    send,
    summary,
    messages,
    sender
  };
}
