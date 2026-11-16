import {
  AppError,
  SAMPLE_TEXT,
  activityStats,
  addSummary,
  initialState,
  isAppSender,
  isAppUrl,
  publicState,
  validateSelection,
  wordCount
} from './core.js';
import { createStore } from './storage.js';
import { summarize, validateApiKey } from './gemini.js';

const store = createStore(chrome.storage.local);
const activeTabs = new Set();
const activePractice = new Set();
let activeCount = 0;
let connecting = false;
let credentialEpoch = 0;

function safeError(error) {
  return error instanceof AppError
    ? { code: error.code, message: error.message }
    : {
        code: 'STORAGE',
        message: 'Could not load or save local data. Please try again.'
      };
}

async function notice(level, title, message) {
  await chrome.storage.session.set({
    notice: { id: crypto.randomUUID(), level, title, message }
  });
  await chrome.action.setBadgeBackgroundColor({ color: '#0868e8' });
  await chrome.action.setBadgeText({
    text: level === 'error' ? '!' : level === 'info' ? '1' : activeCount ? '…' : ''
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
  const message = { type: 'SELECT_SUMMARY_CARD', ...payload };
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    /* A fresh page needs its content script. */
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['summary-card.js', 'content.js']
    });
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    return false;
  }
}

async function handleSelection(selection, tab) {
  if (activeTabs.has(tab?.id)) return;
  activeTabs.add(tab?.id);
  activeCount++;
  let loadingCard = Promise.resolve();
  try {
    const source = validateSelection(selection);
    const state = await store.read();
    if (!state.key)
      throw new AppError('NO_KEY', 'Open Select Summary and connect your Gemini key.');
    await notice('loading', 'Summarizing', 'Waiting for Gemini.');
    loadingCard = showCard(tab.id, { kind: 'loading', text: 'Summarizing…' });
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
        crypto.randomUUID()
      );
    });
    const shown = await showCard(tab.id, { kind: 'summary', text });
    await notice(
      shown ? 'success' : 'info',
      shown ? 'Summary ready' : 'Saved to history',
      shown
        ? 'Available in History.'
        : 'This page cannot display the card. Open History to read it.'
    );
  } catch (error) {
    await loadingCard;
    const problem = safeError(error);
    await showCard(tab?.id, { kind: 'error', text: problem.message });
    await notice('error', 'Unable to summarize', problem.message).catch(() => {});
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
      contexts: ['selection']
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
            element.selectionEnd || 0
          );
        }
        return window.getSelection()?.toString() || '';
      }
    });
    await handleSelection(result, tab);
  } catch {
    await notice(
      'error',
      'This page is protected',
      'Select text on a regular webpage. Browser settings and some viewers do not allow access.'
    );
    try {
      await chrome.action.openPopup();
    } catch {
      /* Guidance remains on the badge. */
    }
  }
});

async function runSandbox(message) {
  if (!['pill', 'shortcut', 'context'].includes(message.method))
    throw new AppError('SANDBOX', 'Choose a sandbox summarization action.');
  const source = validateSelection(message.selection);
  const normalize = (value) => value.replace(/\s+/g, ' ').trim();
  if (!normalize(SAMPLE_TEXT).includes(normalize(source)))
    throw new AppError('SANDBOX', 'Highlight text inside the sample article.');
  const state = await store.read();
  if (!state.key || !state.keyValidated)
    throw new AppError('NO_KEY', 'Verify your Gemini key first.');
  if (
    typeof message.requestId !== 'string' ||
    !/^[a-zA-Z0-9-]{16,64}$/.test(message.requestId)
  )
    throw new AppError('MESSAGE', 'Invalid summary request.');
  const cached = state.history.find((item) => item.id === message.requestId);
  if (cached)
    return {
      summary: cached.text,
      stats: activityStats(state.activity),
      xp: activityStats(state.activity).total * 50,
      firstMilestone: false
    };
  // One in-flight sandbox action per credential, including overlapping pill
  // clicks and native shortcut events. Recent request IDs are deduplicated
  // against the bounded history without retaining an extra request log.
  const activeKey = String(state.credentialRevision);
  if (activePractice.has(activeKey))
    throw new AppError('BUSY', 'Your summary is already on its way.');
  activePractice.add(activeKey);
  try {
    const summary = await summarize(source, state.key);
    let firstMilestone = false;
    const updated = await store.update((current) => {
      if (current.credentialRevision !== state.credentialRevision)
        throw new AppError('CANCELLED', 'Your key changed. Try again.');
      if (current.history.some((item) => item.id === message.requestId)) return current;
      firstMilestone = !current.milestones.firstSummary;
      const next = addSummary(
        current,
        summary,
        wordCount(source),
        Date.now(),
        message.requestId
      );
      return {
        ...next,
        onboarding: { ...next.onboarding, step: 3, sandboxComplete: true }
      };
    });
    const stats = activityStats(updated.activity);
    return { summary, stats, xp: stats.total * 50, firstMilestone };
  } finally {
    activePractice.delete(activeKey);
  }
}

async function appRequest(message) {
  switch (message.type) {
    case 'GET_STATE': {
      const [stored, session, platform, commands] = await Promise.all([
        store.read(),
        chrome.storage.session.get('notice'),
        chrome.runtime.getPlatformInfo(),
        chrome.commands.getAll()
      ]);
      return {
        state: publicState(stored),
        platform: platform.os,
        shortcut:
          commands.find((command) => command.name === 'summarize-selection')?.shortcut ||
          '',
        notice:
          session.notice?.level === 'loading' && !activeCount
            ? null
            : session.notice || null
      };
    }
    case 'OPEN_WELCOME':
      await openWelcome();
      return {};
    case 'SET_WELCOME_STEP':
      if (![1, 2, 3].includes(message.step))
        throw new AppError('MESSAGE', 'Invalid welcome step.');
      await store.update((state) => {
        if (message.step >= 2 && !state.keyValidated)
          throw new AppError('NO_KEY', 'Verify your Gemini key first.');
        if (message.step === 3 && !state.onboarding.sandboxComplete)
          throw new AppError('SANDBOX', 'Generate a live summary first.');
        return { ...state, onboarding: { ...state.onboarding, step: message.step } };
      });
      return {};
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
            'Accept the Google API data notice before connecting.'
          );
        if (epoch !== credentialEpoch)
          throw new AppError('CANCELLED', 'Settings changed. Please connect again.');
        await validateApiKey(key.trim());
        await store.update((state) => {
          if (epoch !== credentialEpoch)
            throw new AppError('CANCELLED', 'Settings changed. Please connect again.');
          return {
            ...state,
            key: key.trim(),
            keyValidated: true,
            credentialRevision: state.credentialRevision + 1,
            onboarding: { ...state.onboarding, step: 2 }
          };
        });
        return {};
      } finally {
        connecting = false;
      }
    }
    case 'SUMMARIZE_SANDBOX':
      return runSandbox(message);
    case 'FINISH_WELCOME':
      await store.update((state) => {
        if (!state.keyValidated || !state.onboarding.sandboxComplete)
          throw new AppError('SANDBOX', 'Generate a live summary first.');
        return {
          ...state,
          onboarding: { ...state.onboarding, step: 3, completed: true }
        };
      });
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
        onboarding: { version: 1, step: 1, completed: false, sandboxComplete: false }
      }));
      return {};
    case 'RESET_ALL':
      credentialEpoch++;
      await store.update((state) => ({
        ...initialState(),
        credentialRevision: state.credentialRevision + 1
      }));
      await chrome.storage.session.remove('notice');
      await chrome.action.setBadgeText({ text: '' });
      return {};
    case 'DISMISS_NOTICE': {
      const { notice: current } = await chrome.storage.session.get('notice');
      if (current?.id === message.id) await chrome.storage.session.remove('notice');
      await chrome.action.setBadgeText({ text: '' });
      return {};
    }
    default:
      throw new AppError('MESSAGE', 'Unknown request.');
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    !isAppSender(sender, chrome.runtime) ||
    !message ||
    typeof message.type !== 'string'
  )
    return false;
  appRequest(message).then(
    (result) => respond({ ok: true, ...result }),
    (error) => respond({ ok: false, error: safeError(error) })
  );
  return true;
});
