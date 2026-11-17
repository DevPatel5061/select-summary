// One timing vocabulary drives both illustrated actions and scene progress.
export const TIMING = Object.freeze({
  move: 500,
  hover: 200,
  down: 140,
  release: 100,
  character: 55
});
export function timeline(steps) {
  const duration = steps.reduce((total, step) => {
    if (typeof step === 'function') return total;
    const [operation, target, value] = step;
    if (operation === 'wait') return total + target;
    if (operation === 'move') return total + (value ?? TIMING.move);
    if (operation === 'type')
      return total + [...value].length * TIMING.character;
    if (operation === 'press')
      return total + TIMING.hover + TIMING.down + TIMING.release;
    throw new Error(`Unknown illustrated action: ${operation}`);
  }, 0);
  return {
    duration,
    async run(api) {
      for (const step of steps) {
        if (typeof step === 'function') step();
        else {
          const [operation, ...args] = step;
          await api[operation](...args);
        }
      }
    }
  };
}
