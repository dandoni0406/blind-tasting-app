// ── Storage abstraction ──────────────────────────────────────────
// Mimics the Claude artifact `window.storage` async API using localStorage.
// Later this single file can be swapped for a Firebase implementation
// without touching app code.

export const storage = {
  async get(key) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? null : { key, value };
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, value);
      return { key, value };
    } catch (e) {
      return null;
    }
  },
  async delete(key) {
    try {
      localStorage.removeItem(key);
      return { key, deleted: true };
    } catch (e) {
      return null;
    }
  },
  async list(prefix = '') {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      return { keys, prefix };
    } catch (e) {
      return { keys: [], prefix };
    }
  },
};

// Make it available as window.storage so existing code keeps working unchanged.
if (typeof window !== 'undefined' && !window.storage) {
  window.storage = storage;
}
