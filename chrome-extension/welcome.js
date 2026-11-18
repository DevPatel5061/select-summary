import { createClient } from './shared/client.js';
import { createKeyField } from './shared/key-field.js';
import { createRefreshQueue } from './shared/refresh.js';
import { decorateButtons } from './icons.js';
import { shortcutKeys, matchesShortcut } from './shortcuts.js';
import { createArticleDemo } from './article-demo.js';
import { createWalkthroughs } from './walkthroughs.js';
import { initializeTheme } from './shared/theme-page.js';

const $ = (selector) => document.querySelector(selector);
const [guideTab] = await Promise.all([chrome.tabs.getCurrent(), initializeTheme()]);
let state;
const welcomeRunId = crypto.randomUUID();
let practiceComplete = false;
let step = 0;
let verifying = false;
let changingKey = false;
let keys = [];
let shortcutSignature = '';
let keyTimer;
let resizeTimer;
const downCodes = new Set();
const walkthroughs = createWalkthroughs(pageError);
const demo = createArticleDemo(async (fields) => {
  const result = await request('SUMMARIZE_DEMO', fields);
  practiceComplete = true;
  updatePractice();
  return result;
});
const request = createClient(() => ({ welcomeRunId }));
const { refresh: snapshot, mutate } = createRefreshQueue(loadSnapshot);
const keyField = createKeyField($('#api-key'), $('#reveal-key'));
async function refreshMetadata() {
  const metadata = await request('GET_METADATA');
  renderKeys(metadata.shortcut, metadata.platform);
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
    : 'Connect your AI.';
  $('#connect-description').textContent = connected
    ? 'Your connection is ready. Continue to try your first summary.'
    : 'Select Summary uses Google Gemini to summarize your text. Your API key connects the two.';
  $('#verified-key').hidden = !connected;
  $('#key-form').hidden = connected;
  $('#continue-connect').hidden = !connected;
  $('#connected-actions').hidden = !connected;
  $('.get-key-row').hidden = connected;
  $('#key-actions').hidden = connected;
  $('#cancel-key').hidden = !changingKey || !state?.keyValidated;
  $('#cancel-key').disabled = verifying;
  $('#back-intro').disabled = verifying;
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
  const text = [...button.childNodes].find(
    (node) => node.nodeType === Node.TEXT_NODE
  );
  if (text) text.textContent = verifying ? 'Connecting…' : 'Connect Gemini';
}

function updatePractice() {
  const complete = practiceComplete;
  const button = $('#continue-sandbox');
  button.disabled = !state?.keyValidated || !complete;
  button.classList.toggle('primary', complete);
  button.classList.toggle('secondary', !complete);
  const label = [...button.childNodes].find(
    (node) => node.nodeType === Node.TEXT_NODE
  );
  if (label) label.textContent = 'Continue';
  $('#practice-instruction').hidden = false;
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
    cap.textContent =
      platform === 'mac' && symbols[key] ? `${symbols[key]} ${key}` : key;
    root.append(cap);
  }
  if (!keys.length)
    root.textContent = 'Set a shortcut at chrome://extensions/shortcuts';
  $('#ready-shortcut-keys').replaceChildren(
    ...[...root.childNodes].map((node) => node.cloneNode(true))
  );
}
async function loadSnapshot() {
  const result = await request('GET_STATE');
  state = result.state;
  if (!verifying) updateConnect();
  updatePractice();
}
async function showStep(next, { persist = true, focus = true } = {}) {
  if (!state) return;
  if (next >= 2 && !state.keyValidated) next = 1;
  if (next === 3 && !practiceComplete) next = 2;
  if (persist && next > 0) {
    await request('SET_WELCOME_STEP', { step: next });
  }
  step = next;
  demo.setEnabled(step === 2);
  clearKeys();
  $('#page-error').hidden = true;
  $('#setup-progress').hidden = false;
  ['intro', 'connect', 'sandbox', 'pin'].forEach((name, index) => {
    const section = $(`#${name}-step`);
    section.hidden = index !== step;
    section.classList.toggle('is-entering', index === step && focus);
  });
  document.querySelectorAll('.step-tab').forEach((button) => {
    const number = Number(button.dataset.step);
    button.disabled =
      (number >= 2 && !state.keyValidated) ||
      (number === 3 && !practiceComplete);
    button.dataset.complete = String(number < step);
    if (number === step) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  walkthroughs.show(step);
  history.replaceState(null, '', step === 0 ? '#welcome' : '#setup');
  if (step === 1) updateConnect();
  if (step === 3) {
    await updatePinStatus();
  }
  if (focus) {
    $(`#${['intro', 'connect', 'sandbox', 'pin'][step]}-title`).focus({
      preventScroll: true
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}
async function updatePinStatus() {
  try {
    const settings = await chrome.action.getUserSettings();
    $('#pin-status').textContent = settings.isOnToolbar
      ? 'Already pinned. You’re good to go.'
      : '';
  } catch {
    /* Compatible browsers may not expose pin status. */
  }
}

$('#api-key').addEventListener('input', () => {
  message($('#key-status'), '');
  $('#api-key').removeAttribute('aria-invalid');
  updateConnect();
});
$('#google-consent').addEventListener('change', updateConnect);
$('#get-started').addEventListener('click', () => showStep(1).catch(pageError));
$('#back-intro').addEventListener('click', () => showStep(0).catch(pageError));
$('#restart-welcome').addEventListener('click', (event) => {
  event.preventDefault();
  if (!verifying) location.replace(chrome.runtime.getURL('welcome.html'));
});
$('#replace-key').addEventListener('click', () => {
  changingKey = true;
  $('#google-consent').checked = false;
  $('#api-key').removeAttribute('aria-invalid');
  message($('#key-status'), '');
  updateConnect();
  $('#api-key').focus();
});
$('#cancel-key').addEventListener('click', () => {
  changingKey = false;
  keyField.clear();
  $('#google-consent').checked = false;
  $('#api-key').removeAttribute('aria-invalid');
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
    await mutate(async () => {
      await request('CONNECT_KEY', {
        key: typedKey,
        useStoredKey: !typedKey && state.keyConfigured && !changingKey,
        consent: $('#google-consent').checked
      });
      keyField.clear();
      changingKey = false;
    });
    await showStep(2);
  } catch (error) {
    message($('#key-status'), error.message, true);
    if (['KEY', 'AUTH'].includes(error.code))
      $('#api-key').setAttribute('aria-invalid', 'true');
    $('#api-key').focus();
  } finally {
    verifying = false;
    $('#api-key').readOnly = false;
    $('#google-consent').disabled = false;
    updateConnect();
  }
});

$('#continue-connect').addEventListener('click', () =>
  showStep(2).catch(pageError)
);
$('#back-connect').addEventListener('click', async () => {
  try {
    await showStep(1);
  } catch (error) {
    pageError(error);
  }
});
$('#continue-sandbox').addEventListener('click', () =>
  showStep(3).catch(pageError)
);
$('#back-sandbox').addEventListener('click', () =>
  showStep(2).catch(pageError)
);
document
  .querySelectorAll('[data-step]')
  .forEach((button) =>
    button.addEventListener('click', () =>
      showStep(Number(button.dataset.step)).catch(pageError)
    )
  );
function renderPressedKeys(event) {
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
}
document.addEventListener('keydown', (event) => {
  if (step !== 2) return;
  downCodes.add(event.code);
  renderPressedKeys(event);
  if (matchesShortcut(event, keys) && !event.repeat) {
    event.preventDefault();
    void demo.summarize('shortcut');
  }
});
document.addEventListener('keyup', (event) => {
  downCodes.delete(event.code);
  if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey)
    clearKeys();
  else renderPressedKeys(event);
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
  $('#page-error').hidden = true;
  $('#finish-welcome').disabled = true;
  try {
    await request('FINISH_WELCOME');
    await request('OPEN_TOOLBAR_POPUP');
  } catch (error) {
    pageError(error);
  } finally {
    $('#finish-welcome').disabled = false;
  }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (!state || area !== 'local' || !changes.appState) return;
  snapshot()
    .then(async () => {
      if (!state.keyConfigured) {
        practiceComplete = false;
        demo.clear();
      }
      if (!state.keyValidated && step > 1)
        await showStep(1, { persist: false });
    })
    .catch(pageError);
});
window.addEventListener('blur', clearKeys);
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!document.hidden) walkthroughs.resize();
  }, 150);
});
document.addEventListener('visibilitychange', () => {
  clearKeys();
  if (document.hidden) {
    walkthroughs.suspend();
    keyField.mask();
  } else
    Promise.all([snapshot(), refreshMetadata()])
      .then(() => {
        walkthroughs.resume();
        if (step === 3) void updatePinStatus();
      })
      .catch(pageError);
});
window.addEventListener('pagehide', () => {
  walkthroughs.stop();
  demo.destroy();
  clearKeys();
  clearTimeout(resizeTimer);
  keyField.clear();
});
async function initialize() {
  decorateButtons();
  // Forward actions read naturally from label to destination; Back keeps its arrow first.
  document.querySelectorAll('button[data-icon="arrow"]').forEach((button) => {
    const arrow = button.querySelector('svg');
    if (arrow) button.append(arrow);
  });
  await request('BEGIN_WELCOME');
  await Promise.all([snapshot(), refreshMetadata()]);
  $('#boot').hidden = true;
  $('#welcome-main').setAttribute('aria-busy', 'false');
  await showStep(0, {
    persist: false,
    focus: false
  });
}
initialize().catch((error) => {
  $('#boot').hidden = true;
  pageError(error);
});
