// A classic script also supports side-effect imports without a separate build.
(() => {
  if (globalThis.SelectSummaryCard) {
    return;
  }

  const svgNamespace = 'http://www.w3.org/2000/svg';

  /** @param {string} tagName @param {Object} attributes @returns {SVGElement} */
  function svgElement(tagName, attributes) {
    const element = document.createElementNS(svgNamespace, tagName);

    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, value);
    }

    return element;
  }

  function appendTimerCircles(svg) {
    for (const className of ['timer-track', 'timer-progress']) {
      svg.append(svgElement('circle', {
        cx: '16',
        cy: '16',
        r: '13',
        pathLength: '100',
        class: className
      }));
    }
  }

  // Original button artwork is dedicated under CC0 1.0.
  /** @param {string} kind @returns {SVGElement} */
  function buttonIcon(kind) {
    const svg = svgElement('svg', {
      viewBox: '0 0 32 32',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.7',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false'
    });

    if (kind === 'close') {
      appendTimerCircles(svg);
    }

    const path = svgElement('path', {
      d: kind === 'close' ? 'M12 12l8 8m0-8-8 8' : 'M12 12h14v14H12zM6 20V6h14'
    });

    svg.append(path);

    return svg;
  }

  function styleHost(host, placement) {
    const styles = {
      all: 'initial',
      'font-family':
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      position: placement === 'floating' ? 'fixed' : 'absolute',
      bottom: '20px',
      right: '20px',
      width: 'min(350px, calc(100% - 40px))',
      'z-index': placement === 'floating' ? '2147483647' : '4'
    };

    // Host-page CSS must not override the card's placement or inherited font.
    for (const [name, value] of Object.entries(styles)) {
      host.style.setProperty(name, value, 'important');
    }

    host.dataset.placement = placement;
  }

  function createShadow(host) {
    const shadow = host.attachShadow({ mode: 'closed' });
    const stylesheet = document.createElement('link');

    stylesheet.rel = 'stylesheet';
    stylesheet.href = chrome.runtime.getURL('summary.css');
    shadow.append(stylesheet);

    return shadow;
  }

  /** @param {Object} [options] @returns {{host: HTMLElement, update: Function, close: Function, destroy: Function}} */
  function create({
    container = document.documentElement,
    placement = 'floating',
    autoDismiss = true,
    onClose = () => {}
  } = {}) {
    const host = document.createElement('select-summary-card');

    styleHost(host, placement);

    const state = {
      host, shadow: createShadow(host), container, autoDismiss, onClose,
      timer: undefined, frame: undefined, kind: 'summary',
      destroyed: false, closing: false, exitAnimation: undefined, card: null
    };

    return {
      host,
      update: (options) => update(state, options),
      close: (reason = 'manual') => close(state, reason),
      destroy: () => destroy(state)
    };
  }

  /** @param {Object} state @returns {void} */
  function clearClock(state) {
    clearTimeout(state.timer);
    cancelAnimationFrame(state.frame);
  }

  /** @param {Object} state @returns {void} */
  function destroy(state) {
    clearClock(state);
    state.destroyed = true;
    state.exitAnimation?.cancel();
    state.host.remove();
  }

  function beginClose(state, reason) {
    state.closing = true;
    clearClock(state);

    const closedKind = state.kind;
    const { onClose } = state;

    state.host.dataset.closing = 'true';
    onClose({ kind: closedKind, reason });
  }

  function animateClose(state) {
    state.exitAnimation = state.host.animate(
      [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(6px)' }
      ],
      { duration: 160, easing: 'ease-in', fill: 'forwards' }
    );
  }

  /** @param {Object} state @param {string} [reason] @returns {Promise<void>} */
  async function close(state, reason = 'manual') {
    if (state.destroyed || state.closing) return;

    beginClose(state, reason);

    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animateClose(state);

      try {
        await state.exitAnimation.finished;
      } catch {
        // Destruction owns removal when it cancels the pending animation.
        return;
      }
    }

    if (state.destroyed) return;

    destroy(state);
  }

  function createBrand() {
    const brand = document.createElement('span');
    const logo = document.createElement('img');
    const brandLabel = document.createElement('span');

    brand.className = 'brand';
    logo.src = chrome.runtime.getURL('icon/onboarding.svg');
    logo.alt = '';
    logo.width = logo.height = 22;
    brandLabel.textContent = 'Select Summary';
    brand.append(logo, brandLabel);

    return brand;
  }

  function dismissDuration(state) {
    if (!state.autoDismiss) return 0;
    if (state.kind === 'summary') return 25_000;
    if (state.kind === 'error') return 10_000;

    return 0;
  }

  function createDismissButton(state) {
    const dismiss = document.createElement('button');

    dismiss.type = 'button';
    dismiss.className = 'close';
    dismiss.setAttribute('aria-label', 'Close summary card');
    dismiss.append(buttonIcon('close'));
    dismiss.addEventListener('click', () => close(state));

    return dismiss;
  }

  function createHeader(brand, dismiss) {
    const header = document.createElement('div');

    header.className = 'header';
    header.append(brand, dismiss);

    return header;
  }

  function createContent(kind, text) {
    if (kind !== 'loading') {
      const paragraph = document.createElement('p');

      paragraph.className = 'text';
      // Provider output stays literal, including any HTML-like source text.
      paragraph.textContent = text;

      return paragraph;
    }

    const skeleton = document.createElement('div');

    skeleton.className = 'skeleton';
    skeleton.setAttribute('aria-hidden', 'true');

    for (let index = 0; index < 3; index++) {
      skeleton.append(document.createElement('span'));
    }

    return skeleton;
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      label.textContent = 'Copied';
    } catch {
      label.textContent = 'Select text to copy';
    }
  }

  function createActions(text) {
    const actions = document.createElement('div');
    const copy = document.createElement('button');
    const label = document.createElement('span');

    actions.className = 'actions';
    copy.type = 'button';
    copy.className = 'copy';
    label.textContent = 'Copy';
    copy.append(buttonIcon('copy'), label);
    copy.addEventListener('click', () => copyText(text, label));
    actions.append(copy);

    return actions;
  }

  function createCard(state) {
    const card = document.createElement('section');
    const { kind, host } = state;

    card.className = `card ${kind}${host.isConnected ? '' : ' is-entering'}`;
    card.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    card.setAttribute(
      'aria-label',
      kind === 'loading' ? 'Generating summary' : 'Select Summary'
    );
    card.setAttribute('aria-busy', String(kind === 'loading'));

    return card;
  }

  function drawClock(state, dismiss, duration) {
    const ring = dismiss.querySelector('.timer-progress');
    const start = performance.now();

    const draw = (now) => {
      const progress = Math.min(1, (now - start) / duration);

      ring.style.strokeDashoffset = String(100 * (1 - progress));

      if (progress < 1) {
        state.frame = requestAnimationFrame(draw);
      }
    };

    state.frame = requestAnimationFrame(draw);
  }

  function startClock(state, dismiss, duration) {
    if (!duration) return;

    state.timer = setTimeout(() => close(state, 'timeout'), duration);

    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      drawClock(state, dismiss, duration);
    }
  }

  function renderCard(state, text) {
    const card = createCard(state);
    const brand = createBrand();
    const duration = dismissDuration(state);
    const dismiss = createDismissButton(state);

    card.append(createHeader(brand, dismiss));
    card.append(createContent(state.kind, text));

    if (state.kind === 'summary') {
      card.append(createActions(text));
    }

    state.shadow.append(card);
    state.card = card;

    if (!state.host.isConnected) {
      state.container.append(state.host);
    }

    startClock(state, dismiss, duration);
  }

  /** @param {Object} state @param {Object} options @returns {void} */
  function update(state, { kind: nextKind = 'summary', text }) {
    if (state.destroyed || state.closing) {
      return;
    }

    clearClock(state);
    state.kind = nextKind;
    state.card?.remove();
    renderCard(state, text);
  }

  globalThis.SelectSummaryCard = Object.freeze({ create });
})();
