import { normalizeSelection } from './core.js';
import { DEMO_ARTICLES } from './demo-articles.js';
import './summary-card.js';

// A local reading surface. Chrome owns the context menu: no contextmenu handler,
// custom menu buttons, intercepted right-click, or automatic provider requests.
export function createArticleDemo(onSummarize) {
  let articleId = 'toronto';
  let enabled = false;
  let busy = false;
  let revision = 0;
  let card;
  const summaries = new Map();
  const $ = (selector) => document.querySelector(selector);
  const viewport = $('#demo-viewport');
  for (const [id, article] of Object.entries(DEMO_ARTICLES))
    $(`[data-demo-text="${id}"]`).textContent = article.text;

  function selectedText() {
    const selection = getSelection();
    if (
      !selection?.rangeCount ||
      selection.isCollapsed ||
      !$(`[data-demo-text="${articleId}"]`).contains(
        selection.getRangeAt(0).commonAncestorContainer
      )
    )
      return '';
    return selection.toString().trim();
  }
  function clearCard() {
    $('#sandbox-status').textContent = '';
    $('#sandbox-status').hidden = true;
    revision++;
    card?.destroy();
    card = null;
  }
  function restoreButton() {
    $('#restore-summary').hidden = !summaries.has(articleId);
  }
  function showCard(payload) {
    if (!card?.host.isConnected || card.host.dataset.closing === 'true')
      card = globalThis.SelectSummaryCard.create({
        container: viewport,
        placement: 'embedded',
        onClose({ kind, reason }) {
          if (kind === 'loading' && reason === 'manual') revision++;
          restoreButton();
        }
      });
    card.update(payload);
    $('#restore-summary').hidden = true;
  }
  function switchArticle(id) {
    if (!Object.hasOwn(DEMO_ARTICLES, id) || id === articleId) return;
    clearCard();
    getSelection()?.removeAllRanges();
    articleId = id;
    document.querySelectorAll('[data-article]').forEach((tab) => {
      const active = tab.dataset.article === id;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      $(`#article-${tab.dataset.article}`).hidden = !active;
    });
    $('#demo-address').value = DEMO_ARTICLES[id].url;
    $('.demo-scroll').scrollTop = 0;
    restoreButton();
  }
  const articleOrder = [...document.querySelectorAll('[data-article]')].map(
    (tab) => tab.dataset.article
  );
  document.querySelectorAll('[data-article]').forEach((tab) => {
    tab.addEventListener('click', () => switchArticle(tab.dataset.article));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
        return;
      event.preventDefault();
      const id =
        event.key === 'Home'
          ? articleOrder[0]
          : event.key === 'End'
            ? articleOrder.at(-1)
            : articleOrder[
                (articleOrder.indexOf(articleId) +
                  (event.key === 'ArrowRight' ? 1 : -1) +
                  articleOrder.length) %
                  articleOrder.length
              ];
      switchArticle(id);
      $(`#tab-${id}`).focus();
    });
  });
  $('#reset-demo').addEventListener('click', () => {
    clearCard();
    summaries.delete(articleId);
    getSelection()?.removeAllRanges();
    restoreButton();
  });
  $('#restore-summary').addEventListener('click', () => {
    if (summaries.has(articleId))
      showCard({ kind: 'summary', text: summaries.get(articleId) });
  });
  document.querySelectorAll('[data-demo-text]').forEach((paragraph) => {
    paragraph.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyA') {
        event.preventDefault();
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        const selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    });
  });
  function clearSelectionError() {
    if (enabled && selectedText()) {
      $('#sandbox-status').textContent = '';
      $('#sandbox-status').hidden = true;
    }
  }
  document.addEventListener('selectionchange', clearSelectionError);
  return {
    setEnabled(value) {
      enabled = value;
      if (!value) {
        clearCard();
        getSelection()?.removeAllRanges();
      } else restoreButton();
    },
    async summarize(method, providedSource) {
      if (!enabled || busy) return;
      const source = method === 'context' ? providedSource : selectedText();
      if (
        !source ||
        !normalizeSelection(DEMO_ARTICLES[articleId].text).includes(
          normalizeSelection(source)
        )
      ) {
        $('#sandbox-status').textContent =
          'Highlight paragraph text in the demo first.';
        $('#sandbox-status').hidden = false;
        return;
      }
      busy = true;
      const id = articleId,
        current = revision;
      $('#sandbox-status').textContent = '';
      $('#sandbox-status').hidden = true;
      showCard({ kind: 'loading' });
      try {
        const result = await onSummarize({
          articleId: id,
          selection: source,
          requestId: crypto.randomUUID()
        });
        summaries.set(id, result.summary);
        if (enabled && articleId === id && revision === current)
          showCard({ kind: 'summary', text: result.summary });
        else restoreButton();
      } catch (error) {
        if (enabled && articleId === id && revision === current)
          showCard({ kind: 'error', text: error.message });
        if (!(enabled && articleId === id && revision === current)) {
          $('#sandbox-status').textContent = error.message;
          $('#sandbox-status').hidden = false;
        }
      } finally {
        busy = false;
      }
    },
    clear() {
      summaries.clear();
      clearCard();
      restoreButton();
    },
    destroy() {
      clearCard();
      document.removeEventListener('selectionchange', clearSelectionError);
    }
  };
}
