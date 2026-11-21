import { MAX_PATH } from "./budget";
import { DEFAULT_PROFILE, isProfileId, type ProfileId } from "./types";

/** Text safe for XML/HTML: control chars and lone surrogates become spaces. */
export function cleanText(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/[\u0000-\u001F\u007F-\u009F\uFFFE\uFFFF]/g, " ")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, " ");
}

export function escapeXml(s: unknown): string {
  return cleanText(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Map a deck link to a URL under `base` ("/wml" or "/lite"). App paths keep
 * their query; `set:profile=<id>` becomes the settings page with that profile;
 * anything else (external, malformed, too long) becomes Home. A non-default
 * profile is carried as `?pf=`.
 */
export function mapHref(href: unknown, base: string, pf: ProfileId = DEFAULT_PROFILE): string {
  let path = "/";
  let profile = pf;
  if (typeof href === "string") {
    const m = /^set:profile=(\w+)$/.exec(href);
    if (m && isProfileId(m[1])) {
      path = "/settings";
      profile = m[1];
    } else if (href.startsWith("/") && href.length <= MAX_PATH) {
      try {
        const u = new URL(href, "http://x");
        if (u.host === "x") path = u.pathname + u.search;
      } catch {
        path = "/";
      }
    }
  }
  const u = new URL(path, "http://x");
  u.searchParams.delete("pf");
  if (profile !== DEFAULT_PROFILE) u.searchParams.set("pf", profile);
  return (u.pathname === "/" ? base : base + u.pathname) + u.search;
}
