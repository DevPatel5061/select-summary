import {
  AppError,
  addSummary,
  initialState,
  isPopupSender,
  publicState,
  validateSelection,
  wordCount
} from './core.js';
import { createStore } from './storage.js';
import { summarize } from './gemini.js';

const store = createStore(chrome.storage.local);
const activeTabs = new Set();
let activeCount = 0;

function safeError(error) {
  return error instanceof AppError
    ? { code: error.code, message: error.message }
    : {
        code: 'STORAGE',
        message:
          'Could not save or load local data. Check available browser storage and try again.'
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

async function showCard(tabId, payload) {
  const message = { type: 'SELECT_SUMMARY_CARD', ...payload };
  try {
    // Reuse the installed listener instead of injecting again for every update.
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    /* A fresh or navigated page needs its content script. */
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    return false;
  }
}

async function handleSelection(selection, tab) {
  if (activeTabs.has(tab?.id)) return;
  const tabId = tab?.id;
  activeTabs.add(tabId);
  activeCount++;
  let loadingCard = Promise.resolve();
  try {
    const source = validateSelection(selection);
    const state = await store.read();
    if (!state.key)
      throw new AppError(
        'NO_KEY',
        'Open Select Summary and connect your Gemini key to get started.'
      );
    await notice('loading', 'Summarizing', 'Waiting for Gemini.');
    // Inject the loading card without delaying the API request on page scripting.
    loadingCard = showCard(tabId, {
      kind: 'loading',
      title: 'Summarizing',
      text: 'Waiting for Gemini.'
    });
    const text = await summarize(source, state.key);
    await loadingCard;
    const timestamp = Date.now();
    const id = crypto.randomUUID();
    await store.update((current) => {
      if (current.credentialRevision !== state.credentialRevision)
        throw new AppError(
          'CANCELLED',
          'Settings changed while summarizing. Please try again.'
        );
      return addSummary(current, text, wordCount(source), timestamp, id);
    });
    const shown = await showCard(tabId, { kind: 'summary', title: 'Summary', text });
    await notice(
      shown ? 'success' : 'info',
      shown ? 'Summary ready' : 'Saved to your history',
      shown
        ? 'Your latest summary is also available in History.'
        : 'This page cannot display the card. Open History to read your summary.'
    );
  } catch (error) {
    await loadingCard;
    const problem = safeError(error);
    await showCard(tabId, {
      kind: 'error',
      title: 'Unable to summarize',
      text: problem.message
    });
    await notice('error', 'Unable to summarize', problem.message).catch(() => {});
  } finally {
    activeTabs.delete(tabId);
    activeCount--;
    if (!activeCount) {
      const data = await chrome.storage.session.get('notice').catch(() => ({}));
      if (!['error', 'info'].includes(data.notice?.level))
        await chrome.action.setBadgeText({ text: '' }).catch(() => {});
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'summarize-selection',
      title: 'Summarize selection',
      contexts: ['selection']
    });
  });
  store.read().catch(() => {});
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'summarize-selection')
    void handleSelection(info.selectionText, tab);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'summarize-selection') return;
  // Chrome can consume registered shortcuts before a popup receives keydown.
  // Give a focused practice screen first refusal so it never calls the API.
  try {
    const response = await chrome.runtime.sendMessage({ type: 'PRACTICE_SHORTCUT' });
    if (response?.handled) return;
  } catch {
    /* No practice screen is open; summarize the actual webpage. */
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
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
      'Select text on a regular webpage. Browser settings, extension stores, and some document viewers do not allow access.'
    );
    try {
      await chrome.action.openPopup();
    } catch {
      /* Badge keeps the guidance available. */
    }
  }
});

async function popupRequest(message) {
  switch (message.type) {
    case 'GET_STATE': {
      const state = publicState(await store.read());
      const { notice: currentNotice } = await chrome.storage.session.get('notice');
      const platform = await chrome.runtime.getPlatformInfo();
      const commands = await chrome.commands.getAll();
      return {
        state,
        platform: platform.os,
        shortcut:
          commands.find((command) => command.name === 'summarize-selection')?.shortcut ||
          '',
        notice:
          currentNotice?.level === 'loading' && !activeCount
            ? null
            : currentNotice || null
      };
    }
    case 'SET_ONBOARDING':
      if (!Number.isInteger(message.step) || message.step < 0 || message.step > 2)
        throw new AppError('MESSAGE', 'Invalid setup step.');
      await store.update((state) => ({ ...state, onboardingStep: message.step }));
      return {};
    case 'CONNECT_KEY': {
      if (
        typeof message.key !== 'string' ||
        !message.key.trim() ||
        message.key.length > 256 ||
        /\s/.test(message.key.trim())
      )
        throw new AppError('KEY', 'Paste a complete API key without spaces.');
      if (message.consent !== true)
        throw new AppError(
          'CONSENT',
          'Review and accept the Google API data notice first.'
        );
      // Save immediately. Key validity is checked by the first real summary,
      // not by a background test request that could consume quota.
      await store.update((state) => ({
        ...state,
        key: message.key.trim(),
        credentialRevision: state.credentialRevision + 1,
        onboardingStep: 2,
        tutorialStep: state.key ? (state.tutorialStep ?? 2) : 0,
        tutorialComplete: state.key ? (state.tutorialComplete ?? true) : false
      }));
      return {};
    }
    case 'COMPLETE_TUTORIAL_STEP':
      await store.update((state) => {
        const expected =
          message.method === 'context' ? 0 : message.method === 'shortcut' ? 1 : -1;
        if (!state.key || expected < 0 || (state.tutorialStep ?? 0) !== expected)
          throw new AppError(
            'TUTORIAL',
            'Complete the right-click step, then the shortcut step.'
          );
        return { ...state, tutorialStep: expected + 1 };
      });
      return {};
    case 'FINISH_TUTORIAL':
      await store.update((state) => {
        if (!state.key || state.tutorialStep !== 2)
          throw new AppError('TUTORIAL', 'Practice both methods before continuing.');
        return { ...state, tutorialComplete: true };
      });
      return {};
    case 'CLEAR_HISTORY':
      await store.update((state) => ({ ...state, history: [] }));
      return {};
    case 'REMOVE_KEY':
      await store.update((state) => ({
        ...state,
        key: null,
        credentialRevision: state.credentialRevision + 1,
        onboardingStep: 0,
        tutorialStep: 0,
        tutorialComplete: false
      }));
      return {};
    case 'RESET_ALL':
      await store.update((state) => ({
        ...initialState(),
        credentialRevision: state.credentialRevision + 1
      }));
      await chrome.storage.session.remove('notice');
      await chrome.action.setBadgeText({ text: '' });
      return {};
    case 'DISMISS_NOTICE': {
      const { notice: currentNotice } = await chrome.storage.session.get('notice');
      if (currentNotice?.id === message.id) await chrome.storage.session.remove('notice');
      await chrome.action.setBadgeText({ text: '' });
      return {};
    }
    default:
      throw new AppError('MESSAGE', 'Unknown request.');
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!isPopupSender(sender, chrome.runtime)) return false;
  if (!message || typeof message.type !== 'string') return false;
  popupRequest(message).then(
    (result) => respond({ ok: true, ...result }),
    (error) => respond({ ok: false, error: safeError(error) })
  );
  return true;
});
