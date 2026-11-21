import { sanitize } from "@/core/sanitize";
import { htmlBytes, type GetBytes } from "./http";
import { TITLE_MAX } from "./parse";

export type WeightBody = { normalBytes: number } | { error: string };

/** Normal Wikipedia article URL for a title, or null if the title is invalid or too long. */
export function articleUrl(title: unknown): string | null {
  if (typeof title !== "string" || title.length > TITLE_MAX) return null;
  const t = sanitize(title, TITLE_MAX);
  return t ? `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_"))}` : null;
}

/** Size of the normal article HTML. Never throws. */
export async function resolveWeight(title: unknown, html: GetBytes = htmlBytes): Promise<{ status: number; body: WeightBody }> {
  const url = articleUrl(title);
  if (!url) return { status: 400, body: { error: "bad title" } };
  try {
    const n = await html(url);
    if (typeof n === "number" && Number.isFinite(n) && n > 0) return { status: 200, body: { normalBytes: n } };
  } catch {
    // fall through
  }
  return { status: 502, body: { error: "unavailable" } };
}
