// Coalesce events, serialize reads, and refresh once after a group of mutations.
export function createRefreshQueue(load) {
  let dirty = false;
  let holds = 0;
  let running = false;
  let timer;
  let waiters = [];
  function schedule() {
    if (!holds && !running && timer === undefined && dirty)
      timer = setTimeout(drain, 0);
  }
  async function drain() {
    timer = undefined;
    if (holds) return;
    running = true;
    try {
      while (dirty && !holds) {
        dirty = false;
        await load();
      }
      if (!holds && !dirty) {
        const finished = waiters;
        waiters = [];
        finished.forEach(({ resolve }) => resolve());
      }
    } catch (error) {
      dirty = false;
      const failed = waiters;
      waiters = [];
      failed.forEach(({ reject }) => reject(error));
    } finally {
      running = false;
      schedule();
    }
  }
  function refresh() {
    dirty = true;
    const result = new Promise((resolve, reject) =>
      waiters.push({ resolve, reject })
    );
    schedule();
    return result;
  }
  async function mutate(action) {
    holds++;
    try {
      return await action();
    } finally {
      holds--;
      await refresh();
    }
  }
  return { refresh, mutate };
}
