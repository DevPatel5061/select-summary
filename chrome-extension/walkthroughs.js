import { timeline, TIMING } from './shared/timeline.js';

// These bundled illustrations never operate real forms, accounts, or clipboard data.
const EXAMPLE_SUMMARY =
  'Toronto is Ontario’s capital and Canada’s largest city, shaped by immigration. It features iconic landmarks like the CN Tower and hosts the Toronto International Film Festival.';

const INTRO = {
  root: '#intro-browser',
  cursor: '#intro-cursor',
  caption: '#intro-caption',
  paint(context, index) {
    context.queryElement('#intro-selection').style.backgroundSize = '';
    context
      .queryElement('#intro-selection')
      .classList.toggle('is-selected', index > 0);
    context.queryElement('#intro-menu').hidden = index !== 1;
    context.queryElement('#intro-result').hidden = index < 2;
    context.introCard.update({ kind: 'summary', text: EXAMPLE_SUMMARY });
  },
  scenes: [
    {
      caption: 'Highlight the part you want to understand.',
      async run(api, context) {
        await api.wait(850);
        const lines = [
          ...context.queryElement('#intro-selection').getClientRects(),
        ];
        const first = lines[0];
        const last = lines.at(-1);
        const root = context
          .queryElement('#intro-browser')
          .getBoundingClientRect();
        await api.point(first.left - root.left, first.top - root.top + 8);
        await Promise.all([
          api.animate(
            '#intro-selection',
            [{ backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%' }],
            800,
          ),
          api.point(
            last.right - root.left - 4,
            last.bottom - root.top - 4,
            800,
          ),
        ]);
        context.queryElement('#intro-selection').classList.add('is-selected');
        await api.wait(1000);
        await api.press('#intro-selection');
      },
    },
    {
      caption: 'Right-click, then choose Summarize selection.',
      async run(api) {
        await api.wait(800);
        await api.move('#intro-summarize');
        await api.press('#intro-summarize');
        await api.wait(450);
      },
    },
    {
      caption: 'A concise summary appears without leaving the page.',
      async run(api, context) {
        context.queryElement('#intro-menu').hidden = true;
        context.introCard.update({ kind: 'loading' });
        await api.wait(1000);
        context.introCard.update({ kind: 'summary', text: EXAMPLE_SUMMARY });
        await api.wait(1400);
      },
    },
  ],
  finished: 'Read the summary without leaving the page.',
};

const STUDIO = {
  root: '#studio-guide',
  cursor: '#studio-cursor',
  caption: '#guide-caption',
  paint: studioScene,
  scenes: [
    {
      caption: 'Open API Keys in Google AI Studio, then choose Create API key.',
      steps: [
        ['wait', 1300],
        ['move', '#mock-create', 650],
        ['press', '#mock-create'],
        ['wait', 450],
      ],
    },
    {
      caption:
        'Name your key, then choose a project. Already have one? You can use it.',
      steps: [
        (context) => {
          context.queryElement('#mock-name').textContent = '';
        },
        ['wait', 700],
        ['move', '#mock-name'],
        ['type', '#mock-name', 'Select Summary'],
        ['wait', 650],
        ['move', '#mock-project'],
        ['press', '#mock-project', (context) => projectOptions(context, false)],
        ['wait', 700],
        ['move', '#mock-new-project'],
        ['press', '#mock-new-project'],
      ],
    },
    {
      caption: 'For a new project, give it a name and select it for your key.',
      steps: [
        (context) => {
          context.queryElement('#mock-project-name').textContent = '';
        },
        ['wait', 850],
        ['move', '#mock-project-name'],
        ['type', '#mock-project-name', 'Select Summary'],
        ['wait', 650],
        ['move', '#mock-project-create'],
        [
          'press',
          '#mock-project-create',
          (context) => {
            studioScene(context, 1);
            projectOptions(context, true);
          },
        ],
        ['wait', 750],
        ['move', '#mock-project-option'],
        [
          'press',
          '#mock-project-option',
          (context) => {
            context.queryElement('#mock-options').hidden = true;
            context.queryElement('#mock-project-label').textContent =
              'Select Summary';
          },
        ],
        ['wait', 700],
        ['move', '#mock-create-confirm'],
        ['press', '#mock-create-confirm'],
      ],
    },
    {
      caption:
        'Copy the new key. Keep project billing disabled to use an eligible free tier.',
      steps: [
        ['wait', 1000],
        ['move', '#mock-copy'],
        [
          'press',
          '#mock-copy',
          (context) => {
            context.queryElement('#mock-copy').lastChild.textContent = 'Copied';
          },
        ],
        ['wait', 1500],
      ],
    },
  ],
  finished:
    'Return here, paste your key in the real form, and choose Connect Gemini.',
};

const PIN = {
  root: '#pin-illustration',
  cursor: '#pin-cursor',
  caption: '#pin-caption',
  paint(context, index) {
    context.queryElement('#pin-menu').hidden = index === 0;
    context.queryElement('#pinned-example').hidden = index < 2;
    context
      .queryElement('#pin-example')
      .classList.toggle('is-pinned', index >= 2);
  },
  scenes: [
    {
      caption: 'Open Extensions in your browser toolbar.',
      async run(api, context) {
        await api.wait(1000);
        await api.move('#pin-extensions', 700);
        await api.press('#pin-extensions', () => {
          context.queryElement('#pin-menu').hidden = false;
        });
        await api.wait(600);
      },
    },
    {
      caption: 'Find Select Summary and click the pin beside its name.',
      async run(api, context) {
        await api.wait(800);
        await api.move('#pin-example', 600);
        await api.press('#pin-example', () => {
          context.queryElement('#pin-example').classList.add('is-pinned');
          context.queryElement('#pinned-example').hidden = false;
        });
        await api.wait(1000);
      },
    },
    {
      caption: 'The icon stays in your toolbar, ready when you need it.',
      async run(api) {
        await api.wait(1300);
      },
    },
  ],
  finished:
    'Use your browser toolbar to pin it. You can also finish without pinning.',
};

/** @returns {(selector: string) => Element | null} */
function createElementQuery() {
  const elements = new Map();

  return (selector) => {
    const cachedElement = elements.get(selector);

    if (cachedElement) return cachedElement;

    const element = document.querySelector(selector);

    // Welcome-page illustration nodes persist across scene changes.
    if (element) elements.set(selector, element);

    return element;
  };
}

function createSceneControls() {
  return [...document.querySelectorAll('[data-guide-scene]')].map((button) => ({
    button,
    fill: button.querySelector('.scene-fill'),
  }));
}

function bindStep(context, step) {
  if (typeof step === 'function') return () => step(context);

  return step.map((argument) =>
    typeof argument === 'function' ? () => argument(context) : argument,
  );
}

function bindScene(context, scene) {
  if (scene.steps) {
    return {
      caption: scene.caption,
      ...timeline(scene.steps.map((step) => bindStep(context, step))),
    };
  }

  return {
    caption: scene.caption,
    run: (api) => scene.run(api, context),
  };
}

/** @param {Object} context @param {number} index @returns {void} */
function studioScene(context, index) {
  const queryElement = context.queryElement;

  queryElement('#create-overlay').hidden = index !== 1;
  queryElement('#project-overlay').hidden = index !== 2;
  queryElement('#copy-overlay').hidden = index !== 3;
  queryElement('#mock-options').hidden = true;
  queryElement('#mock-project-option').hidden = true;
  queryElement('#mock-new-project').hidden = false;
  queryElement('#mock-name').textContent = 'Select Summary';
  queryElement('#mock-project-name').textContent = 'Select Summary';
  queryElement('#mock-project-label').textContent = 'Create project';
  queryElement('#mock-copy').lastChild.textContent = 'Copy';
}

/** @param {Object} context @param {boolean} existing @returns {void} */
function projectOptions(context, existing) {
  const options = context.queryElement('#mock-options');
  const project = context.queryElement('#mock-project');

  options.hidden = false;
  options.style.top = `${project.offsetTop + project.offsetHeight + 5}px`;
  context.queryElement('#mock-project-option').hidden = !existing;
  context.queryElement('#mock-new-project').hidden = existing;
}

function createTrackState(context, name, definition) {
  return {
    context,
    name,
    surface: context.queryElement(definition.root),
    pointer: context.queryElement(definition.cursor),
    label: context.queryElement(definition.caption),
    scenes: definition.scenes.map((scene) => bindScene(context, scene)),
    paint: (index) => definition.paint(context, index),
    finished: definition.finished,
    animations: new Set(),
    delays: new Set(),
    controller: undefined,
    index: 0,
    paused: false,
    ended: false,
    visited: false,
    automaticallyPaused: false,
  };
}

/** @param {Object} context @param {string} name @param {Object} definition @returns {Object} */
function createTrack(context, name, definition) {
  const state = createTrackState(context, name, definition);
  const track = trackControls(state);

  context.tracks.set(name, track);

  return track;
}

/** @param {Object} state @returns {void} */
function update(state) {
  if (state.name !== 'studio') return;

  state.context.sceneControls.forEach(({ button, fill }) => {
    const position = Number(button.dataset.guideScene);
    const complete = position < state.index || state.ended;

    button.dataset.complete = String(complete);
    fill.style.transform = complete ? 'scaleX(1)' : 'scaleX(0)';
    button.setAttribute(
      'aria-pressed',
      String(Number(button.dataset.guideScene) === state.index),
    );
  });
}

/** @param {Object} state @returns {void} */
function abort(state) {
  state.controller?.abort();
  state.controller = undefined;
  state.surface
    .querySelectorAll('.is-hovered, .is-pressed')
    .forEach((node) => node.classList.remove('is-hovered', 'is-pressed'));
  state.pointer.classList.remove('is-clicking');
  state.pointer.hidden = true;
}

function cleanupDelay(delay) {
  clearTimeout(delay.timer);
  delay.state.delays.delete(delay.controls);
  delay.signal.removeEventListener('abort', delay.stop);
}

function pauseDelay(delay) {
  if (delay.timer === undefined) return;

  clearTimeout(delay.timer);
  delay.remaining = Math.max(
    0,
    delay.remaining - (performance.now() - delay.began),
  );
  delay.timer = undefined;
}

function resumeDelay(delay) {
  if (delay.timer !== undefined || delay.signal.aborted) return;

  delay.began = performance.now();
  delay.timer = setTimeout(() => {
    delay.timer = undefined;
    cleanupDelay(delay);
    delay.resolve();
  }, delay.remaining);
}

function createDelay(state, milliseconds, signal, resolve, reject) {
  const delay = {
    state,
    signal,
    resolve,
    remaining: milliseconds,
  };

  delay.controls = {
    pause: () => pauseDelay(delay),
    resume: () => resumeDelay(delay),
  };
  delay.stop = () => {
    cleanupDelay(delay);
    reject(new DOMException('Stopped', 'AbortError'));
  };
  state.delays.add(delay.controls);
  signal.addEventListener('abort', delay.stop, { once: true });

  if (!state.paused) delay.controls.resume();
}

/** @param {Object} state @param {number} milliseconds @param {AbortSignal} signal @returns {Promise<void>} */
function wait(state, milliseconds, signal) {
  // Retaining remaining time lets a return from AI Studio resume mid-scene.
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      return reject(new DOMException('Stopped', 'AbortError'));
    }

    createDelay(state, milliseconds, signal, resolve, reject);
  });
}

function createAnimation(state, node, frames, duration, signal) {
  if (signal.aborted) throw new DOMException('Stopped', 'AbortError');

  const animation = node.animate(frames, {
    duration,
    easing: 'cubic-bezier(.4,0,.2,1)',
    fill: 'forwards',
  });

  state.animations.add(animation);

  if (state.paused) animation.pause();

  return animation;
}

/** @param {Object} state @param {Element} node @param {Object[]} frames @param {number} duration @param {AbortSignal} signal @returns {Promise<void>} */
async function animate(state, node, frames, duration, signal) {
  const animation = createAnimation(state, node, frames, duration, signal);
  const stop = () => animation.cancel();

  signal.addEventListener('abort', stop, { once: true });

  try {
    await animation.finished;

    if (!signal.aborted) Object.assign(node.style, frames.at(-1));
  } catch {
    throw new DOMException('Stopped', 'AbortError');
  } finally {
    state.animations.delete(animation);
    signal.removeEventListener('abort', stop);
    // Final styles survive cancellation without retaining a filled animation.
    animation.cancel();
  }
}

/** @param {Object} state @param {number} x @param {number} y @param {AbortSignal} signal @param {number} [duration] @returns {Promise<void>} */
async function point(state, x, y, signal, duration = TIMING.move) {
  const transform = `translate(${x}px, ${y}px)`;

  state.pointer.hidden = false;

  await animate(
    state,
    state.pointer,
    [{ transform: state.pointer.style.transform || transform }, { transform }],
    duration,
    signal,
  );
}

async function move(state, target, signal, duration = TIMING.move) {
  const node =
    typeof target === 'string' ? state.context.queryElement(target) : target;

  // Geometry changes with viewport size even though the DOM nodes stay stable.
  const bounds = node.getBoundingClientRect();
  const origin = state.surface.getBoundingClientRect();

  await point(
    state,
    bounds.left - origin.left + bounds.width / 2,
    bounds.top - origin.top + bounds.height / 2,
    signal,
    duration,
  );
}

async function press(state, target, action, signal) {
  const node =
    typeof target === 'string' ? state.context.queryElement(target) : target;

  node.classList.add('is-hovered');

  try {
    await wait(state, TIMING.hover, signal);
    node.classList.add('is-pressed');
    state.pointer.classList.add('is-clicking');
    await wait(state, TIMING.down, signal);
    action();
    await wait(state, TIMING.release, signal);
  } finally {
    node.classList.remove('is-hovered', 'is-pressed');
    state.pointer.classList.remove('is-clicking');
  }
}

async function type(state, target, text, signal) {
  const node = state.context.queryElement(target);

  node.textContent = '';

  for (const character of text) {
    node.textContent += character;
    await wait(state, TIMING.character, signal);
  }
}

/** @param {Object} state @param {boolean} [automatic] @returns {void} */
function pause(state, automatic = false) {
  if (!state.controller || state.paused) return;

  state.paused = true;
  state.automaticallyPaused = automatic;
  state.animations.forEach((animation) => animation.pause());
  state.delays.forEach((delay) => delay.pause());
  update(state);
}

function resume(state) {
  state.automaticallyPaused = false;

  if (state.context.reducedMotion.matches) return;
  if (!state.controller) return start(state, state.ended ? 0 : state.index);

  state.paused = false;
  state.animations.forEach((animation) => animation.play());
  state.delays.forEach((delay) => delay.resume());
  update(state);
}

function sceneApi(state, signal) {
  return {
    wait: (milliseconds) => wait(state, milliseconds, signal),
    move: (target, duration) => move(state, target, signal, duration),
    point: (x, y, duration) => point(state, x, y, signal, duration),
    press: (target, action = () => {}) => press(state, target, action, signal),
    type: (target, text) => type(state, target, text, signal),
    animate: (target, frames, duration) =>
      animate(
        state,
        state.context.queryElement(target),
        frames,
        duration,
        signal,
      ),
  };
}

/** @param {Object} state @returns {void} */
function paintFinished(state) {
  state.paint(state.index);
  state.label.textContent = state.finished;
  state.ended = true;
  update(state);
}

function prepareStart(state, from) {
  abort(state);
  state.visited = true;
  state.ended = false;
  state.paused = false;
  state.automaticallyPaused = false;
  state.index = from;
}

/** @param {Object} state @param {number} [from] @returns {void} */
function start(state, from = 0) {
  prepareStart(state, from);

  if (state.context.reducedMotion.matches) {
    state.index = state.scenes.length - 1;
    paintFinished(state);

    return;
  }

  state.controller = new AbortController();

  const signal = state.controller.signal;

  state.pointer.style.transform = 'translate(24px, 86px)';

  const api = sceneApi(state, signal);

  void runScenes(state, from, signal, api);
}

function runScene(state, scene, signal, api) {
  state.index = scene;
  state.paint(state.index);
  state.label.textContent = state.scenes[scene].caption;
  update(state);

  const meter =
    state.name === 'studio'
      ? state.context.queryElement(`[data-guide-scene="${scene}"] .scene-fill`)
      : null;

  if (!meter) return state.scenes[scene].run(api);

  return Promise.all([
    state.scenes[scene].run(api),
    animate(
      state,
      meter,
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      state.scenes[scene].duration,
      signal,
    ),
  ]);
}

function finishCycle(state) {
  state.ended = true;
  state.pointer.hidden = true;
  state.label.textContent = state.finished;
  update(state);
}

function restartCycle(state) {
  state.ended = false;
  state.pointer.style.transform = 'translate(24px, 86px)';
}

function handleTrackError(state, error) {
  if (error.name === 'AbortError') return;

  abort(state);

  const { onError } = state.context;

  onError(error);
}

async function runScenes(state, from, signal, api) {
  try {
    while (!signal.aborted) {
      for (let scene = from; scene < state.scenes.length; scene++) {
        if (signal.aborted) return;

        await runScene(state, scene, signal, api);
      }

      if (signal.aborted) return;

      finishCycle(state);
      await wait(state, 1500, signal);
      from = 0;
      restartCycle(state);
    }
  } catch (error) {
    handleTrackError(state, error);
  }
}

function resize(state) {
  const shouldSkip =
    !state.visited || state.ended || state.context.reducedMotion.matches;

  if (shouldSkip) return;

  const keepPaused = state.paused;
  const keepAutomatic = state.automaticallyPaused;

  start(state, state.index);

  if (keepPaused) pause(state, keepAutomatic);
}

function staticScene(state, scene) {
  abort(state);
  state.visited = true;
  state.index = scene;
  state.ended = false;
  state.paused = true;
  state.automaticallyPaused = false;
  state.paint(state.index);
  state.label.textContent = state.scenes[state.index].caption;
  update(state);
}

function motionChanged(state, shouldPlay) {
  if (!state.visited) return;

  if (shouldPlay) {
    start(state);

    return;
  }

  abort(state);
  state.index = state.scenes.length - 1;
  paintFinished(state);
}

function resumeTrack(state) {
  const shouldResume =
    state.automaticallyPaused ||
    (!state.controller &&
      state.visited &&
      !state.context.reducedMotion.matches);

  if (shouldResume) resume(state);
}

function trackControls(state) {
  return {
    show() {
      start(state);
      update(state);
    },
    suspend: () => pause(state, true),
    resume: () => resumeTrack(state),
    resize: () => resize(state),
    playScene: (scene) => start(state, scene),
    staticScene: (scene) => staticScene(state, scene),
    motionChanged: (shouldPlay) => motionChanged(state, shouldPlay),
    stop: () => abort(state),
  };
}

function bindSceneButtons(context, studio) {
  context.sceneControls.forEach(({ button }) => {
    button.addEventListener('click', () =>
      context.reducedMotion.matches
        ? studio.staticScene(Number(button.dataset.guideScene))
        : studio.playScene(Number(button.dataset.guideScene)),
    );
  });
}

function bindMotionChanges(context) {
  context.reducedMotion.addEventListener('change', () =>
    context.tracks.forEach((track) =>
      track.motionChanged(
        !context.reducedMotion.matches &&
          !document.hidden &&
          track === context.active,
      ),
    ),
  );
}

function show(context, step) {
  const next = context.tracks.get(
    step === 0 ? 'intro' : step === 1 ? 'studio' : step === 3 ? 'pin' : '',
  );

  if (context.active !== next) context.active?.suspend();

  context.active = next;
  context.active?.show();
}

function walkthroughControls(context) {
  return {
    show: (step) => show(context, step),
    suspend: () => context.active?.suspend(),
    resume: () => context.active?.resume(),
    resize: () => context.active?.resize(),
    stop() {
      context.tracks.forEach((track) => track.stop());
      context.introCard.destroy();
    },
  };
}

function createContext(onError) {
  const queryElement = createElementQuery();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const tracks = new Map();
  const introCard = globalThis.SelectSummaryCard.create({
    container: queryElement('#intro-result'),
    placement: 'embedded',
    autoDismiss: false,
  });

  return {
    queryElement,
    reducedMotion,
    tracks,
    introCard,
    onError,
    active: undefined,
    sceneControls: createSceneControls(),
  };
}

/** @param {(error: Error) => void} onError @returns {{show: Function, suspend: Function, resume: Function, resize: Function, stop: Function}} */
export function createWalkthroughs(onError) {
  const context = createContext(onError);

  createTrack(context, 'intro', INTRO);

  const studio = createTrack(context, 'studio', STUDIO);

  bindSceneButtons(context, studio);
  createTrack(context, 'pin', PIN);
  bindMotionChanges(context);

  return walkthroughControls(context);
}
