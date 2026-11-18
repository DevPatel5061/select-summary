import {
  AppError,
  HISTORY_LIMITS,
  INTERFACE_VERSION,
  addSummary,
  initialState,
  isAppSender,
  isAppUrl,
  publicState,
  normalizeSelection,
  validateSelection,
  wordCount,
} from './core.js';
import { createStore } from './storage.js';
import { summarize, validateApiKey } from './gemini.js';
import { DEMO_ARTICLES } from './demo-articles.js';
import { readTheme, THEME_KEY } from './shared/theme.js';

const store = createStore(chrome.storage.local);
const activeTabs = new Set();
const activeDemos = new Set();
let activeCount = 0;
let connecting = false;
let credentialEpoch = 0;

function safeError(error) {
  return error instanceof AppError
    ? { code: error.code, message: error.message }
    : {
        code: 'STORAGE',
        message: 'Could not load or save local data. Please try again.',
      };
}

async function notice(level, title, message) {
  await chrome.storage.session.set({
    notice: { id: crypto.randomUUID(), level, title, message },
  });
  await chrome.action.setBadgeBackgroundColor({ color: '#15473e' });
  await chrome.action.setBadgeText({
    text:
      level === 'error' ? '!' : level === 'info' ? '1' : activeCount ? '…' : '',
  });
}

async function openWelcome() {
  const url = chrome.runtime.getURL('welcome.html');
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => tab.url?.split(/[?#]/)[0] === url);
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true, url });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url, active: true });
  }
}

// Route practice by the actual tab, never by document.hasFocus(). Browser
// shortcuts may change focus before the extension receives the command.
async function routePractice(type, tab, selection) {
  if (!isAppUrl(tab?.url, chrome.runtime)) return false;
  try {
    await chrome.runtime.sendMessage({ type, targetTabId: tab.id, selection });
  } catch {
    /* The welcome page may still be loading. Never inject a card here. */
  }
  return true;
}

async function showCard(tabId, payload) {
  const theme = await readTheme().catch(() => 'light');
  const message = { type: 'SELECT_SUMMARY_CARD', ...payload, theme };
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    /* A fresh page needs its content script. */
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['summary-card.js', 'content.js'],
    });
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    return false;
  }
}

async function updatePageCards() {
  const tabs = await chrome.tabs.query({});
  const theme = await readTheme();

  // Content scripts receive the palette name without access to local storage.
  await Promise.allSettled(
    tabs.map(({ id }) =>
      chrome.tabs.sendMessage(id, { type: 'SELECT_SUMMARY_THEME', theme }),
    ),
  );
}

chrome.storage.local.onChanged.addListener((changes) => {
  if (changes[THEME_KEY]) void updatePageCards().catch(() => {});
});

async function handleSelection(selection, tab) {
  if (activeTabs.has(tab?.id)) return;
  activeTabs.add(tab?.id);
  activeCount++;
  let loadingCard = Promise.resolve();
  try {
    const source = validateSelection(selection);
    const state = await store.read();
    if (!state.key)
      throw new AppError(
        'NO_KEY',
        'Open Select Summary and connect your Gemini key.',
      );
    await notice('loading', 'Summarizing', 'Waiting for Gemini.');
    loadingCard = showCard(tab.id, { kind: 'loading' });
    const text = await summarize(source, state.key);
    await loadingCard;
    await store.update((current) => {
      if (current.credentialRevision !== state.credentialRevision)
        throw new AppError('CANCELLED', 'Settings changed. Please try again.');
      return addSummary(
        current,
        text,
        wordCount(source),
        Date.now(),
        crypto.randomUUID(),
      );
    });
    const shown = await showCard(tab.id, { kind: 'summary', text });
    await notice(
      shown ? 'success' : 'info',
      shown ? 'Summary ready' : 'Saved to history',
      shown
        ? 'Available in History.'
        : 'This page cannot display the card. Open History to read it.',
    );
  } catch (error) {
    await loadingCard;
    const problem = safeError(error);
    await showCard(tab?.id, { kind: 'error', text: problem.message });
    await notice('error', 'Unable to summarize', problem.message).catch(
      () => {},
    );
  } finally {
    activeTabs.delete(tab?.id);
    activeCount--;
    if (!activeCount) {
      const data = await chrome.storage.session.get('notice').catch(() => ({}));
      if (!['error', 'info'].includes(data.notice?.level))
        await chrome.action.setBadgeText({ text: '' }).catch(() => {});
    }
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'summarize-selection',
      title: 'Summarize selection',
      contexts: ['selection'],
    });
  });
  // Reloads and updates must not repeatedly open onboarding tabs.
  if (details.reason === 'install') await openWelcome().catch(() => {});
  await store.read().catch(() => {});
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'summarize-selection') return;
  if (await routePractice('PRACTICE_CONTEXT', tab, info.selectionText)) return;
  await handleSelection(info.selectionText, tab);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'summarize-selection') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  if (await routePractice('PRACTICE_SHORTCUT', tab)) return;

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const element = document.activeElement;
        if (
          element instanceof HTMLTextAreaElement ||
          (element instanceof HTMLInputElement &&
            ['text', 'search', 'url', 'tel'].includes(element.type))
        ) {
          return element.value.slice(
            element.selectionStart || 0,
            element.selectionEnd || 0,
          );
        }
        return window.getSelection()?.toString() || '';
      },
    });
    await handleSelection(result, tab);
  } catch {
    await notice(
      'error',
      'This page is protected',
      'Select text on a regular webpage. Browser settings and some viewers do not allow access.',
    );
    try {
      await chrome.action.openPopup();
    } catch {
      /* Guidance remains on the badge. */
    }
  }
});

// The demo uses the same provider and local accounting as normal summaries.
// A request ID prevents duplicate responses from awarding activity twice.
let welcomeQueue = Promise.resolve();
function updateWelcomeSession(key, transform) {
  const operation = welcomeQueue.then(async () => {
    const current = (await chrome.storage.session.get(key))[key];
    const next = transform(current);
    if (next) await chrome.storage.session.set({ [key]: next });
  });
  welcomeQueue = operation.catch(() => {});
  return operation;
}
async function welcomeRun(message, sender, requireComplete = false) {
  if (
    !sender.tab ||
    sender.url?.split(/[?#]/)[0] !== chrome.runtime.getURL('welcome.html')
  )
    throw new AppError('MESSAGE', 'Open the welcome guide to continue.');
  const key = `welcomeRun:${sender.tab.id}`;
  const run = (await chrome.storage.session.get(key))[key];
  if (
    !run ||
    run.id !== message.welcomeRunId ||
    (requireComplete && !run.complete)
  )
    throw new AppError(
      'SANDBOX',
      'Summarize some practice text in this walkthrough first.',
    );
  return { key, run };
}
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(`welcomeRun:${tabId}`).catch(() => {});
});
async function summarizeDemo(message, sender) {
  const session = await welcomeRun(message, sender);
  const article = Object.hasOwn(DEMO_ARTICLES, message.articleId)
    ? DEMO_ARTICLES[message.articleId]
    : null;
  const source = validateSelection(message.selection);
  if (
    !article ||
    !normalizeSelection(article.text).includes(normalizeSelection(source))
  )
    throw new AppError('SELECTION', 'Highlight paragraph text in the demo.');
  if (
    typeof message.requestId !== 'string' ||
    !/^[a-zA-Z0-9-]{16,64}$/.test(message.requestId)
  )
    throw new AppError('MESSAGE', 'Invalid summary request.');
  const state = await store.read();
  if (!state.keyValidated || !state.key)
    throw new AppError('NO_KEY', 'Verify your Gemini key first.');
  const previous = state.history.find((item) => item.id === message.requestId);
  if (previous) return { summary: previous.text };
  if (activeDemos.has(state.credentialRevision))
    throw new AppError('BUSY', 'Your summary is already on its way.');
  activeDemos.add(state.credentialRevision);
  try {
    const summary = await summarize(source, state.key);
    await store.update((current) => {
      if (current.credentialRevision !== state.credentialRevision)
        throw new AppError('CANCELLED', 'Your key changed. Please try again.');
      const next = addSummary(
        current,
        summary,
        wordCount(source),
        Date.now(),
        message.requestId,
      );
      return next;
    });
    // A response from an older walkthrough must never unlock a restarted one.
    await updateWelcomeSession(session.key, (currentRun) =>
      currentRun?.id === session.run.id
        ? { ...currentRun, complete: true }
        : null,
    );
    return { summary };
  } finally {
    activeDemos.delete(state.credentialRevision);
  }
}

async function appRequest(message, sender) {
  switch (message.type) {
    case 'BEGIN_WELCOME': {
      if (
        !sender.tab ||
        sender.url?.split(/[?#]/)[0] !==
          chrome.runtime.getURL('welcome.html') ||
        typeof message.welcomeRunId !== 'string' ||
        !/^[a-zA-Z0-9-]{16,64}$/.test(message.welcomeRunId)
      )
        throw new AppError('MESSAGE', 'Invalid walkthrough session.');
      await updateWelcomeSession(`welcomeRun:${sender.tab.id}`, () => ({
        id: message.welcomeRunId,
        complete: false,
      }));
      return {};
    }
    case 'GET_STATE': {
      const [stored, session] = await Promise.all([
        store.read(),
        chrome.storage.session.get('notice'),
      ]);
      return {
        interfaceVersion: INTERFACE_VERSION,
        state: publicState(stored),
        notice:
          session.notice?.level === 'loading' && !activeCount
            ? null
            : session.notice || null,
      };
    }
    case 'GET_METADATA': {
      const [platform, commands] = await Promise.all([
        chrome.runtime.getPlatformInfo(),
        chrome.commands.getAll(),
      ]);
      return {
        platform: platform.os,
        shortcut:
          commands.find((command) => command.name === 'summarize-selection')
            ?.shortcut || '',
      };
    }
    case 'OPEN_WELCOME':
      await openWelcome();
      return {};
    case 'SET_WELCOME_STEP': {
      await welcomeRun(message, sender, message.step === 3);
      if (![1, 2, 3].includes(message.step))
        throw new AppError('MESSAGE', 'Invalid welcome step.');
      const state = await store.read();
      if (message.step >= 2 && !state.keyValidated)
        throw new AppError('NO_KEY', 'Verify your Gemini key first.');
      return {};
    }
    case 'CONNECT_KEY': {
      if (connecting)
        throw new AppError('BUSY', 'A connection check is already running.');
      // Reserve the connection slot before reading storage, so two welcome
      // tabs cannot both validate while waiting for the same queued read.
      connecting = true;
      const epoch = credentialEpoch;
      try {
        const current = await store.read();
        const key = message.useStoredKey === true ? current.key : message.key;
        if (
          typeof key !== 'string' ||
          !key.trim() ||
          key.length > 256 ||
          /\s/.test(key.trim())
        )
          throw new AppError('KEY', 'Paste a complete API key without spaces.');
        if (message.consent !== true)
          throw new AppError(
            'CONSENT',
            'Accept the Google API data notice before connecting.',
          );
        if (epoch !== credentialEpoch)
          throw new AppError(
            'CANCELLED',
            'Settings changed. Please connect again.',
          );
        await validateApiKey(key.trim());
        await store.update((state) => {
          if (epoch !== credentialEpoch)
            throw new AppError(
              'CANCELLED',
              'Settings changed. Please connect again.',
            );
          return {
            ...state,
            key: key.trim(),
            keyValidated: true,
            credentialRevision: state.credentialRevision + 1,
          };
        });
        return {};
      } finally {
        connecting = false;
      }
    }
    case 'SUMMARIZE_DEMO':
      return summarizeDemo(message, sender);
    case 'FINISH_WELCOME':
      await welcomeRun(message, sender, true);
      await store.update((state) => {
        if (!state.keyValidated)
          throw new AppError('NO_KEY', 'Verify your Gemini key first.');
        return {
          ...state,
          onboarding: { completed: true },
        };
      });
      return {};
    case 'OPEN_TOOLBAR_POPUP': {
      await welcomeRun(message, sender, true);
      const state = await store.read();
      if (!state.keyValidated || !state.onboarding.completed)
        throw new AppError(
          'NO_KEY',
          'Finish setup before opening Select Summary.',
        );
      // Open against another active tab so removing the inactive guide does not
      // dismiss the popup. Keep the guide available if opening fails.
      const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
      let target = tabs.find((tab) => tab.id !== sender.tab.id);
      const needsNewTab = !target;
      if (!target) {
        // Closing a window's only tab would also destroy its toolbar popup.
        target = await chrome.tabs.create({
          windowId: sender.tab.windowId,
          active: false,
        });
      }
      try {
        await chrome.tabs.update(target.id, { active: true });
        await chrome.action.openPopup({ windowId: sender.tab.windowId });
      } catch {
        await chrome.tabs.update(sender.tab.id, { active: true });
        if (needsNewTab) await chrome.tabs.remove(target.id);
        throw new AppError(
          'POPUP',
          'Your browser could not open the popup. Open Select Summary from your browser’s Extensions menu.',
        );
      }
      await chrome.tabs.remove(sender.tab.id);
      return {};
    }
    case 'SET_HISTORY_LIMIT':
      if (!HISTORY_LIMITS.includes(message.limit))
        throw new AppError(
          'MESSAGE',
          'Choose a history limit of 5, 10, 15, or 20.',
        );
      await store.update((state) => ({
        ...state,
        historyLimit: message.limit,
        history: state.history.slice(0, message.limit),
      }));
      return {};
    case 'CLEAR_HISTORY':
      await store.update((state) => ({ ...state, history: [] }));
      return {};
    case 'REMOVE_KEY':
      credentialEpoch++;
      await store.update((state) => ({
        ...state,
        key: null,
        keyValidated: false,
        credentialRevision: state.credentialRevision + 1,
        onboarding: { completed: false },
      }));
      return {};
    case 'RESET_ALL':
      credentialEpoch++;
      await store.update((state) => ({
        ...initialState(),
        credentialRevision: state.credentialRevision + 1,
      }));
      await chrome.storage.local.remove(THEME_KEY);
      await chrome.storage.session.remove('notice');
      await chrome.action.setBadgeText({ text: '' });
      return {};
    case 'DISMISS_NOTICE': {
      const { notice: current } = await chrome.storage.session.get('notice');
      if (current?.id === message.id)
        await chrome.storage.session.remove('notice');
      await chrome.action.setBadgeText({ text: '' });
      return {};
    }
    default:
      throw new AppError(
        'UPDATE_REQUIRED',
        'Reload Select Summary at chrome://extensions, then reopen the welcome guide.',
      );
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    !isAppSender(sender, chrome.runtime) ||
    !message ||
    typeof message.type !== 'string'
  )
    return false;
  appRequest(message, sender).then(
    (result) => respond({ ok: true, ...result }),
    (error) => respond({ ok: false, error: safeError(error) }),
  );
  return true;
});
