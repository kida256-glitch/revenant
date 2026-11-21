const TIMEOUT_MS = 5000;
const MAX_BODY = 1_000_000;
const MAX_ENTRIES = 200;

const cache = new Map<string, { value: unknown; at: number }>();

export interface JsonResult {
  json: unknown;
  stale: boolean;
}

export type GetJson = (url: string, ttlMs: number) => Promise<JsonResult>;

export function userAgent(): string {
  const contact = process.env.REVENANT_CONTACT || "https://github.com/kida256-glitch/revenant";
  return `Revenant/0.1 (${contact}; Kiroween hackathon)`;
}

/**
 * Fetch JSON with a 5 s timeout, size cap, in-memory cache and Next data
 * cache. On failure, serves a stale cached value (stale: true) or throws.
 */
export const getJson: GetJson = async (url, ttlMs) => {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return { json: hit.value, stale: false };
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": userAgent(), Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BODY) throw new Error("too large");
    const text = await res.text();
    if (text.length > MAX_BODY) throw new Error("too large");
    const value: unknown = JSON.parse(text);
    cache.delete(url);
    cache.set(url, { value, at: Date.now() });
    if (cache.size > MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return { json: value, stale: false };
  } catch (err) {
    if (hit) return { json: hit.value, stale: true };
    throw err;
  }
};

export type GetBytes = (url: string) => Promise<number | undefined>;
const MAX_HTML = 10_000_000;
const sizes = new Map<string, { n: number; at: number }>();

/**
 * Real uncompressed byte length of a normal web page (5 s timeout). Never
 * throws: returns undefined on any failure so callers can fail open.
 */
export const htmlBytes: GetBytes = async (url) => {
  const hit = sizes.get(url);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.n;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": userAgent(), Accept: "text/html" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return undefined;
    const n = (await res.arrayBuffer()).byteLength;
    if (n === 0 || n > MAX_HTML) return undefined;
    if (sizes.size >= MAX_ENTRIES) sizes.clear();
    sizes.set(url, { n, at: Date.now() });
    return n;
  } catch {
    return undefined;
  }
};