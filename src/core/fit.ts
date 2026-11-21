import type { Card, Profile } from "./types";

/** True if a line produced by `wrap` is the first part of a hard-split word. */
function isContinuation(line: string, cols: number): boolean {
  return line.length === cols && !line.includes(" ") && line.endsWith("-");
}

/**
 * Word-wrap plain text to `cols`. Words that don't fit are hard-split into
 * `cols-1` chars plus "-". Words of exactly `cols` chars ending in "-" are
 * split too so `unwrap` is unambiguous.
 */
export function wrap(text: string, cols: number): string[] {
  const width = Math.max(2, Math.floor(cols));
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let w = word;
    const needsSplit = (x: string) => x.length > width || (x.length === width && x.endsWith("-"));
    if (needsSplit(w)) {
      if (cur) lines.push(cur);
      cur = "";
      while (needsSplit(w)) {
        lines.push(w.slice(0, width - 1) + "-");
        w = w.slice(width - 1);
      }
      cur = w;
      continue;
    }
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= width) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Inverse of `wrap`: rejoin lines into space-separated words. */
export function unwrap(lines: string[], cols: number): string {
  let out = "";
  let glue = false;
  for (const line of lines) {
    if (out && !glue) out += " ";
    if (isContinuation(line, Math.max(2, Math.floor(cols)))) {
      out += line.slice(0, -1);
      glue = true;
    } else {
      out += line;
      glue = false;
    }
  }
  return out;
}

/** Fit a single-line label; visible "~" marks shortening. */
export function fitLine(text: string, cols: number): string {
  return text.length <= cols ? text : text.slice(0, Math.max(0, cols - 1)) + "~";
}

export function bodyRows(profile: Profile): number {
  return profile.rows - 1;
}

/** Paginate already-sanitized text into one-screen cards. */
export function paginate(title: string, text: string, profile: Profile, idPrefix = "c"): Card[] {
  const lines = wrap(text, profile.cols);
  const per = bodyRows(profile);
  const t = fitLine(title, profile.cols);
  const cards: Card[] = [];
  for (let i = 0; i < lines.length; i += per) {
    cards.push({ id: `${idPrefix}${cards.length}`, title: t, lines: lines.slice(i, i + per), links: [] });
  }
  if (cards.length === 0) cards.push({ id: `${idPrefix}0`, title: t, lines: [], links: [] });
  return cards;
}
