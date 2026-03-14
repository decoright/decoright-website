type CacheEnvelope<T> = {
  value: T;
  expiresAt: number;
  version: number;
};

const CACHE_VERSION = 1;

export function getCachedValue<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || parsed.version !== CACHE_VERSION) {
      localStorage.removeItem(key);
      return null;
    }

    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.value;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number) {
  try {
    const envelope: CacheEnvelope<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
      version: CACHE_VERSION,
    };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Ignore cache write failures (quota/private mode).
  }
}

export function clearCachedValue(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore cache clear failures.
  }
}
