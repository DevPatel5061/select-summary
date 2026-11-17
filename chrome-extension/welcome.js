import { decorateButtons } from './icons.js';
import { shortcutKeys, matchesShortcut } from './shortcuts.js';
import { createArticleDemo } from './article-demo.js';
import { createWalkthroughs } from './walkthroughs.js';

const $ = (selector) => document.querySelector(selector);
const guideTab = await chrome.tabs.getCurrent();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let state;
let step = 1;
let verifying = false;
let changingKey = false;
let snapshotSerial = 0;
let confettiTimer;
let keys = [];
let shortcutSignature = '';
let keyTimer;
let resizeTimer;
const downCodes = new Set();
const walkthroughs = createWalkthroughs(pageError);
const demo = createArticleDemo(async (fields) => {
  const result = await request('SUMMARIZE_DEMO', fields);
  await snapshot();
  return result;
});
async function request(type, fields = {}) {
  let response;
  try {
    response = await chrome.runtime.sendMessage({ type, ...fields });
  } catch {
    throw new Error('The extension disconnected. Reload this page and try again.');
  }
  if (!response?.ok && response?.error?.message === 'Unknown request.')
    throw new Error(
      'Reload Select Summary at chrome://extensions, then reopen the welcome guide.'
    );
  if (!response?.ok)
    throw new Error(
      response?.error?.message || 'Could not complete that action. Try again.'
    );
  return response;
}
function pageError(error) {
  $('#page-error').textContent = error.message;
  $('#page-error').hidden = false;
}
function message(node, text, error = false) {
  node.textContent = text;
  node.dataset.error = String(error);
  node.setAttribute('role', error ? 'alert' : 'status');
}
function updateConnect() {
  const connected = state?.keyValidated && !changingKey;
  $('#connect-title').textContent = connected
    ? 'Gemini connected.'
    : 'Add your Gemini key.';
  $('#verified-key').hidden = !connected;
  $('#key-form').hidden = connected;
  $('#continue-connect').hidden = !connected;
  $('#connected-actions').hidden = !connected;
  $('#cancel-key').hidden = false;
  $('#cancel-key').disabled = verifying || !changingKey || !state?.keyValidated;
  $('#saved-key-label').textContent = `Key ending in ${state?.keySuffix || ''}`;
  const useStored = Boolean(state?.keyConfigured && !changingKey);
  $('#stored-key-hint').hidden = !useStored;
  $('#stored-key-hint').textContent = useStored
    ? `Saved key ending in ${state.keySuffix}. Leave blank to verify it.`
    : '';
  $('#verify-key').disabled =
    verifying ||
    !$('#google-consent').checked ||
    (!$('#api-key').value.trim() && !useStored);
  const button = $('#verify-key');
  const text = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
  if (text) text.textContent = verifying ? 'Verifying…' : 'Verify & continue';
}

function clearKeys() {
  clearTimeout(keyTimer);
  downCodes.clear();
  document
    .querySelectorAll('#shortcut-keys kbd')
    .forEach((cap) => cap.classList.remove('is-pressed'));
}
function renderKeys(shortcut, platform) {
  const signature = JSON.stringify([shortcut, platform]);
  if (signature === shortcutSignature) return;
  clearKeys();
  shortcutSignature = signature;
  keys = shortcutKeys(shortcut, platform);
  const root = $('#shortcut-keys');
  root.replaceChildren();
  const symbols = { Option: '⌥', Shift: '⇧', Ctrl: '⌃', Command: '⌘' };
  for (const key of keys) {
    const cap = document.createElement('kbd');
    cap.dataset.key = key;
    cap.textContent = platform === 'mac' && symbols[key] ? `${symbols[key]} ${key}` : key;
    root.append(cap);
  }
  if (!keys.length) root.textContent = 'Set a shortcut at chrome://extensions/shortcuts';
}
async function snapshot() {
  const serial = ++snapshotSerial;
  const result = await request('GET_STATE');
  if (result.interfaceVersion !== 1)
    throw new Error(
      'Reload Select Summary at chrome://extensions, then reopen the welcome guide.'
    );
  if (serial !== snapshotSerial) return;
  state = result.state;
  renderKeys(result.shortcut, result.platform);
  if (!verifying) updateConnect();
  $('#continue-sandbox').disabled = !state.onboarding.sandboxComplete;
}
async function showStep(next, { persist = true, focus = true } = {}) {
  if (!state) return;
  if (next >= 2 && !state.keyValidated) next = 1;
  if (next === 3 && !state.onboarding.sandboxComplete) next = 2;
  if (persist) {
    await request('SET_WELCOME_STEP', { step: next });
    state.onboarding.step = next;
  }
  step = next;
  demo.setEnabled(step === 2);
  clearKeys();
  $('#page-error').hidden = true;
  $('#step-label').textContent = `Step ${step} of 3`;
  ['connect', 'sandbox', 'pin'].forEach((name, index) => {
    $(`#${name}-step`).hidden = index + 1 !== step;
  });
  document.querySelectorAll('.step-tab').forEach((button) => {
    const number = Number(button.dataset.step);
    button.disabled =
      number === 2
        ? !state.keyValidated
        : number === 3
          ? !state.onboarding.sandboxComplete
          : false;
    button.dataset.complete = String(number < step);
    if (number === step) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  walkthroughs.show(step);
  if (step === 1) updateConnect();
  if (step === 3) {
    await updatePinStatus();
  }
  if (focus) {
    $(`#${['connect', 'sandbox', 'pin'][step - 1]}-title`).focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}
function celebrate() {
  clearTimeout(confettiTimer);
  const layer = $('#confetti');
  layer.replaceChildren();
  if (reducedMotion.matches) return;
  for (let index = 0; index < 18; index++) {
    const piece = document.createElement('i');
    piece.style.setProperty('--piece', index);
    layer.append(piece);
  }
  layer.hidden = false;
  confettiTimer = setTimeout(() => {
    layer.hidden = true;
    layer.replaceChildren();
  }, 1300);
}
async function updatePinStatus() {
  try {
    const settings = await chrome.action.getUserSettings();
    $('#pin-status').textContent = settings.isOnToolbar ? 'Already pinned.' : '';
  } catch {
    /* Compatible browsers may not expose pin status. */
  }
}

$('#api-key').addEventListener('input', updateConnect);
$('#google-consent').addEventListener('change', updateConnect);
$('#reveal-key').addEventListener('click', () => {
  const visible = $('#api-key').type === 'password';
  $('#api-key').type = visible ? 'text' : 'password';
  $('#reveal-key').setAttribute('aria-pressed', String(visible));
  $('#reveal-key').setAttribute(
    'aria-label',
    visible ? 'Hide entered key' : 'Show entered key'
  );
});
$('#replace-key').addEventListener('click', () => {
  changingKey = true;
  $('#google-consent').checked = false;
  updateConnect();
  $('#api-key').focus();
});
$('#cancel-key').addEventListener('click', () => {
  changingKey = false;
  $('#api-key').value = '';
  $('#api-key').type = 'password';
  $('#reveal-key').setAttribute('aria-pressed', 'false');
  $('#reveal-key').setAttribute('aria-label', 'Show entered key');
  $('#google-consent').checked = false;
  message($('#key-status'), '');
  updateConnect();
  $('#continue-connect').focus();
});
$('#open-studio').addEventListener('click', () =>
  chrome.tabs.create({ url: 'https://aistudio.google.com/apikey' })
);
$('#key-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if ($('#verify-key').disabled || verifying) return;
  const typedKey = $('#api-key').value.trim();
  verifying = true;
  $('#api-key').readOnly = true;
  $('#google-consent').disabled = true;
  updateConnect();
  message($('#key-status'), '');
  try {
    await request('CONNECT_KEY', {
      key: typedKey,
      useStoredKey: !typedKey && state.keyConfigured && !changingKey,
      consent: $('#google-consent').checked
    });
    $('#api-key').value = '';
    $('#api-key').type = 'password';
    $('#reveal-key').setAttribute('aria-pressed', 'false');
    $('#reveal-key').setAttribute('aria-label', 'Show entered key');
    changingKey = false;
    await snapshot();
    celebrate();
    await showStep(2);
  } catch (error) {
    message($('#key-status'), error.message, true);
  } finally {
    verifying = false;
    $('#api-key').readOnly = false;
    $('#google-consent').disabled = false;
    updateConnect();
  }
});

$('#continue-connect').addEventListener('click', () => showStep(2).catch(pageError));
$('#back-connect').addEventListener('click', async () => {
  try {
    await showStep(1);
  } catch (error) {
    pageError(error);
  }
});
$('#continue-sandbox').addEventListener('click', () => showStep(3).catch(pageError));
$('#back-sandbox').addEventListener('click', () => showStep(2).catch(pageError));
document
  .querySelectorAll('[data-step]')
  .forEach((button) =>
    button.addEventListener('click', () =>
      showStep(Number(button.dataset.step)).catch(pageError)
    )
  );
document.addEventListener('keydown', (event) => {
  if (step !== 2) return;
  downCodes.add(event.code);
  const modifiers = {
    Alt: event.altKey,
    Option: event.altKey,
    Shift: event.shiftKey,
    Ctrl: event.ctrlKey,
    Command: event.metaKey,
    Meta: event.metaKey
  };
  document.querySelectorAll('#shortcut-keys kbd').forEach((cap) => {
    const key = cap.dataset.key;
    cap.classList.toggle(
      'is-pressed',
      Object.hasOwn(modifiers, key)
        ? modifiers[key]
        : downCodes.has(
            /^[0-9]$/.test(key)
              ? `Digit${key}`
              : key.length === 1
                ? `Key${key.toUpperCase()}`
                : key
          )
    );
  });
  if (matchesShortcut(event, keys) && !event.repeat) {
    event.preventDefault();
    void demo.summarize('shortcut');
  }
});
document.addEventListener('keyup', (event) => {
  downCodes.delete(event.code);
  if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) clearKeys();
  else
    document.querySelectorAll('#shortcut-keys kbd').forEach((cap) => {
      const modifiers = {
        Alt: event.altKey,
        Option: event.altKey,
        Shift: event.shiftKey,
        Ctrl: event.ctrlKey,
        Command: event.metaKey,
        Meta: event.metaKey
      };
      const key = cap.dataset.key;
      cap.classList.toggle(
        'is-pressed',
        Object.hasOwn(modifiers, key)
          ? modifiers[key]
          : downCodes.has(key.length === 1 ? `Key${key.toUpperCase()}` : key)
      );
    });
});
chrome.runtime.onMessage.addListener((payload, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    sender.tab ||
    payload?.targetTabId !== guideTab?.id ||
    !['PRACTICE_SHORTCUT', 'PRACTICE_CONTEXT'].includes(payload.type)
  )
    return false;
  respond({ handled: true });
  if (step === 2) {
    if (payload.type === 'PRACTICE_SHORTCUT') {
      document
        .querySelectorAll('#shortcut-keys kbd')
        .forEach((cap) => cap.classList.add('is-pressed'));
      clearTimeout(keyTimer);
      keyTimer = setTimeout(clearKeys, 200);
    }
    void demo.summarize(
      payload.type === 'PRACTICE_CONTEXT' ? 'context' : 'shortcut',
      payload.selection
    );
  }
  return false;
});
$('#finish-welcome').addEventListener('click', async () => {
  $('#finish-welcome').disabled = true;
  try {
    await request('FINISH_WELCOME');
    const tab = await chrome.tabs.getCurrent();
    await chrome.tabs.remove(tab.id);
  } catch (error) {
    $('#finish-welcome').disabled = false;
    pageError(error);
  }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (!state || area !== 'local' || !changes.appState) return;
  snapshot()
    .then(async () => {
      if (!state.keyConfigured) demo.clear();
      if (!state.keyValidated && step !== 1) await showStep(1, { persist: false });
      else if (!state.onboarding.sandboxComplete && step === 3)
        await showStep(2, { persist: false });
    })
    .catch(pageError);
});
window.addEventListener('blur', clearKeys);
window.addEventListener('resize', () => {
  walkthroughs.stop();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!document.hidden) walkthroughs.show(step);
  }, 150);
});
document.addEventListener('visibilitychange', () => {
  clearKeys();
  if (document.hidden) {
    walkthroughs.stop();
    $('#api-key').type = 'password';
    $('#reveal-key').setAttribute('aria-pressed', 'false');
    $('#reveal-key').setAttribute('aria-label', 'Show entered key');
  } else
    snapshot()
      .then(() => {
        walkthroughs.show(step);
        if (step === 3) void updatePinStatus();
      })
      .catch(pageError);
});
window.addEventListener('pagehide', () => {
  walkthroughs.stop();
  demo.destroy();
  clearKeys();
  clearTimeout(confettiTimer);
  clearTimeout(resizeTimer);
  $('#api-key').value = '';
});
async function initialize() {
  decorateButtons();
  await snapshot();
  if (state.onboarding.completed && location.hash === '#dashboard') {
    location.replace(chrome.runtime.getURL('popup.html'));
    return;
  }
  $('#boot').hidden = true;
  $('#welcome-main').setAttribute('aria-busy', 'false');
  await showStep(state.onboarding.completed ? 1 : state.onboarding.step, {
    persist: false,
    focus: false
  });
}
initialize().catch((error) => {
  $('#boot').hidden = true;
  pageError(error);
});
