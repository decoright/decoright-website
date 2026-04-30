const inFlight = new Map<string, Promise<unknown>>();
const lastRunAt = new Map<string, number>();

export async function dedupeRequest<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = factory().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, promise);
  return promise;
}

export function throttleCall(key: string, minIntervalMs: number): boolean {
  const now = Date.now();
  const last = lastRunAt.get(key) || 0;
  if (now - last < minIntervalMs) return false;
  lastRunAt.set(key, now);
  return true;
}

export function debounce<T extends (...args: any[]) => void>(fn: T, waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, waitMs);
  };
}
