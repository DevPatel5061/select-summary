// Loaded on demand after summary-card.js; the page never receives credentials.
(() => {
  if (globalThis.__selectSummaryInstalled) return;
  globalThis.__selectSummaryInstalled = true;
  let card;
  let dismissedWhileLoading = false;

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (
      sender.id !== chrome.runtime.id ||
      sender.tab ||
      message?.type !== 'SELECT_SUMMARY_CARD'
    )
      return;
    if (
      !['summary', 'loading', 'error'].includes(message.kind) ||
      (message.kind !== 'loading' && typeof message.text !== 'string')
    )
      return;
    if (message.kind === 'loading') dismissedWhileLoading = false;
    if (dismissedWhileLoading && message.kind !== 'loading') return;
    if (!card?.host.isConnected || card.host.dataset.closing === 'true') {
      card = globalThis.SelectSummaryCard.create({
        onClose({ kind, reason }) {
          dismissedWhileLoading = kind === 'loading' && reason === 'manual';
        }
      });
    }
    card.update(message);
  });
})();
