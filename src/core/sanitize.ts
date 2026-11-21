export const MAX_TEXT = 20_000;

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", hellip: "...",
};

const PUNCT: Record<string, string> = {
  "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u201c": '"', "\u201d": '"', "\u201e": '"',
  "\u2013": "-", "\u2014": "-", "\u2212": "-", "\u2026": "...", "\u00b0": " deg", "\u00d7": "x",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,8});/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function stripTags(s: string): string {
  return s
    .replace(/<(script|style)\b[^]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>?/g, " ");
}

/**
 * Turn untrusted input into plain printable ASCII text: markup and control
 * characters removed, whitespace collapsed, length capped. A cap is marked
 * with a visible "~" (never silent). Non-strings become "".
 */
export function sanitize(input: unknown, max: number = MAX_TEXT): string {
  if (typeof input !== "string") return "";
  const limit = Math.max(1, Math.floor(max));
  let s = input.length > limit * 4 ? input.slice(0, limit * 4) : input;
  s = stripTags(s);
  s = decodeEntities(s);
  s = stripTags(s);
  s = s.replace(/={2,}/g, " ");
  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[\u2018-\u201e\u2013\u2014\u2212\u2026\u00b0\u00d7]/g, (c) => PUNCT[c] ?? "?");
  s = s.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ");
  s = s.replace(/[^\x20-\x7e]/gu, "?");
  s = s.replace(/\s+/g, " ").trim();
  const cut = s.length > limit;
  if (cut) s = s.slice(0, Math.max(0, limit - 2)).trimEnd() + " ~";
  return s;
}
