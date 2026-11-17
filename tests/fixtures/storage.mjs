export function memoryStorage(data = {}) {
  const calls = { get: 0, set: 0, remove: 0, access: 0 };
  return {
    data,
    calls,
    async get(keys) {
      calls.get++;
      return Object.fromEntries(
        (Array.isArray(keys) ? keys : [keys]).map((key) => [
          key,
          structuredClone(data[key])
        ])
      );
    },
    async set(value) {
      calls.set++;
      Object.assign(data, structuredClone(value));
    },
    async remove(keys) {
      calls.remove++;
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
    },
    async setAccessLevel() {
      calls.access++;
    }
  };
}
