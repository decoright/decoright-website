
// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../types/database.types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment");
}


const WINDOW_MS = 60_000;
const GLOBAL_MAX_REQUESTS = 120;
const COOLDOWN_MS = 15_000;

const endpointLimits: Array<{ pattern: RegExp; max: number }> = [
  { pattern: /\/rest\/v1\/messages/i, max: 70 },
  { pattern: /\/rest\/v1\/chat_rooms/i, max: 50 },
  { pattern: /\/functions\/v1\//i, max: 20 },
];

let requestHistory: number[] = [];
const endpointHistory = new Map<string, number[]>();
let cooldownUntil = 0;

function pruneWindow(history: number[], now: number) {
  return history.filter((timestamp) => now - timestamp < WINDOW_MS);
}

function getRequestPath(input: RequestInfo | URL): string {
  try {
    if (typeof input === 'string') return new URL(input, window.location.origin).pathname;
    if (input instanceof URL) return input.pathname;
    if (input instanceof Request) return new URL(input.url, window.location.origin).pathname;
    return '';
  } catch {
    return '';
  }
}

const rateLimitedFetch: typeof fetch = async (input, init) => {
  const now = Date.now();
  const path = getRequestPath(input);
  requestHistory = pruneWindow(requestHistory, now);

  if (cooldownUntil > now) {
    throw new Error('rate_limited_client_cooldown');
  }

  if (requestHistory.length >= GLOBAL_MAX_REQUESTS) {
    cooldownUntil = now + COOLDOWN_MS;
    const errorMsg = `Supabase request blocked by global limiter (${GLOBAL_MAX_REQUESTS} req/min exceeded).`;
    console.error(errorMsg, { path });
    throw new Error('rate_limited_client_global');
  }

  for (const rule of endpointLimits) {
    if (!rule.pattern.test(path)) continue;

    const key = rule.pattern.source;
    const endpointReqs = pruneWindow(endpointHistory.get(key) || [], now);

    if (endpointReqs.length >= rule.max) {
      cooldownUntil = now + COOLDOWN_MS;
      const errorMsg = `Supabase request blocked for endpoint (${rule.max} req/min exceeded).`;
      console.error(errorMsg, { path, pattern: rule.pattern.source });
      throw new Error('rate_limited_client_endpoint');
    }

    endpointReqs.push(now);
    endpointHistory.set(key, endpointReqs);
  }

  requestHistory.push(now);
  return fetch(input, init);
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: rateLimitedFetch
  }
});
