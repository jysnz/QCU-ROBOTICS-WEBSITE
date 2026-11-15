/* Tiny in-memory cache for the admin panel (lives until the tab is closed or the admin signs out).
   Lists and counts that were refetched on every tab switch are now reused for a short time; writes call bust() so
   the next read is fresh. No library, no storage: nothing here survives a reload. */
type Entry = { data: unknown; at: number; promise?: Promise<unknown> };
const store = new Map<string, Entry>();

/** Returns the cached value when it is younger than ttlMs, otherwise runs the fetcher (shared by concurrent callers). */
export function cached<T>(key: string, fetcher: () => Promise<T>, ttlMs = 30_000): Promise<T> {
  const hit = store.get(key);
  if (hit?.promise) return hit.promise as Promise<T>;
  if (hit && hit.data !== undefined && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.data as T);
  const promise = fetcher().then(
    (data) => {
      store.set(key, { data, at: Date.now() });
      return data;
    },
    (err) => {
      // keep any older value for peek(), but don't keep a failed request around
      const prev = store.get(key);
      if (prev) store.set(key, { data: prev.data, at: prev.at });
      else store.delete(key);
      throw err;
    },
  );
  store.set(key, { data: hit?.data, at: hit?.at ?? 0, promise });
  return promise;
}

/** The last value for a key (even if stale), for showing something instantly while a fresh load runs. */
export function peek<T>(key: string): T | undefined {
  return store.get(key)?.data as T | undefined;
}

/** Forgets every entry whose key starts with the prefix (call after a write). */
export function bust(...prefixes: string[]) {
  for (const key of [...store.keys()]) if (prefixes.some((p) => key.startsWith(p))) store.delete(key);
}

/** Forgets everything (call on sign-out). */
export function clearAll() {
  store.clear();
}

/** After any edit: drop every cached list and the Overview numbers so the next read is fresh. */
export const bustContent = () => bust("crud:", "people:", "tp:", "overview");
