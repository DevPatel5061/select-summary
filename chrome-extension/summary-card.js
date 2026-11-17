// Shared by isolated content scripts and the welcome page. This classic script
// also works as a side-effect module, so no remote imports or build step is needed.
(() => {
  if (globalThis.SelectSummaryCard) return;

  // Original button artwork, dedicated under CC0 1.0. SVGs stay inside buttons.
  function buttonIcon(kind) {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    const attributes = {
      viewBox: '0 0 32 32',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.7',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false'
    };
    for (const [name, value] of Object.entries(attributes))
      svg.setAttribute(name, value);
    if (kind === 'close') {
      for (const className of ['timer-track', 'timer-progress']) {
        const circle = document.createElementNS(namespace, 'circle');
        for (const [name, value] of Object.entries({
          cx: '16',
          cy: '16',
          r: '13',
          pathLength: '100',
          class: className
        }))
          circle.setAttribute(name, value);
        svg.append(circle);
      }
    }
    const path = document.createElementNS(namespace, 'path');
    path.setAttribute(
      'd',
      kind === 'close' ? 'M12 12l8 8m0-8-8 8' : 'M12 12h14v14H12zM6 20V6h14'
    );
    svg.append(path);
    return svg;
  }

  function create({
    container = document.documentElement,
    placement = 'floating',
    autoDismiss = true,
    onClose = () => {}
  } = {}) {
    const host = document.createElement('select-summary-card');
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
    for (const [name, value] of Object.entries(styles))
      host.style.setProperty(name, value, 'important');
    host.dataset.placement = placement;
    const shadow = host.attachShadow({ mode: 'closed' });
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = chrome.runtime.getURL('summary.css');
    shadow.append(stylesheet);
    let timer;
    let frame;
    let kind = 'summary';
    let destroyed = false;
    let closing = false;
    let exitAnimation;

    function clearClock() {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    }
    function destroy() {
      clearClock();
      destroyed = true;
      exitAnimation?.cancel();
      host.remove();
    }
    async function close(reason = 'manual') {
      if (destroyed || closing) return;
      closing = true;
      clearClock();
      const closedKind = kind;
      host.dataset.closing = 'true';
      onClose({ kind: closedKind, reason });
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        exitAnimation = host.animate(
          [
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(6px)' }
          ],
          { duration: 160, easing: 'ease-in', fill: 'forwards' }
        );
        try {
          await exitAnimation.finished;
        } catch {
          return;
        }
      }
      if (destroyed) return;
      destroy();
    }
    function update({ kind: nextKind = 'summary', text }) {
      if (destroyed || closing) return;
      clearClock();
      kind = nextKind;
      shadow.querySelector('.card')?.remove();
      const card = document.createElement('section');
      card.className = `card ${kind}${host.isConnected ? '' : ' is-entering'}`;
      card.setAttribute('role', kind === 'error' ? 'alert' : 'status');
      card.setAttribute(
        'aria-label',
        kind === 'loading' ? 'Generating summary' : 'Select Summary'
      );
      card.setAttribute('aria-busy', String(kind === 'loading'));
      const header = document.createElement('div');
      header.className = 'header';
      const brand = document.createElement('span');
      brand.className = 'brand';
      const logo = document.createElement('img');
      logo.src = chrome.runtime.getURL('icon/onboarding.svg');
      logo.alt = '';
      logo.width = logo.height = 22;
      const brandLabel = document.createElement('span');
      brandLabel.textContent = 'Select Summary';
      brand.append(logo, brandLabel);
      const duration = !autoDismiss
        ? 0
        : kind === 'summary'
          ? 25_000
          : kind === 'error'
            ? 10_000
            : 0;
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'close';
      dismiss.setAttribute('aria-label', 'Close summary card');
      dismiss.append(buttonIcon('close'));
      dismiss.addEventListener('click', () => close());
      header.append(brand, dismiss);
      card.append(header);
      if (kind === 'loading') {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton';
        skeleton.setAttribute('aria-hidden', 'true');
        for (let index = 0; index < 3; index++)
          skeleton.append(document.createElement('span'));
        card.append(skeleton);
      } else {
        const paragraph = document.createElement('p');
        paragraph.className = 'text';
        paragraph.textContent = text;
        card.append(paragraph);
      }
      if (kind === 'summary') {
        const actions = document.createElement('div');
        actions.className = 'actions';
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'copy';
        const label = document.createElement('span');
        label.textContent = 'Copy';
        copy.append(buttonIcon('copy'), label);
        copy.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(text);
            label.textContent = 'Copied';
          } catch {
            label.textContent = 'Select text to copy';
          }
        });
        actions.append(copy);
        card.append(actions);
      }
      shadow.append(card);
      if (!host.isConnected) container.append(host);
      if (duration) {
        timer = setTimeout(() => close('timeout'), duration);
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const ring = dismiss.querySelector('.timer-progress');
          const start = performance.now();
          const draw = (now) => {
            const progress = Math.min(1, (now - start) / duration);
            ring.style.strokeDashoffset = String(100 * (1 - progress));
            if (progress < 1) frame = requestAnimationFrame(draw);
          };
          frame = requestAnimationFrame(draw);
        }
      }
    }
    return { host, update, close, destroy };
  }

  globalThis.SelectSummaryCard = Object.freeze({ create });
})();
