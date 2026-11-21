import { escapeXml as e, mapHref } from "./markup";
import { DEFAULT_PROFILE, type Deck, type Link, type ProfileId } from "./types";

export const LITE_MAX = 3072;
const KEYS = "123456789";

/**
 * Serialize a deck to a tiny no-JS, no-CSS HTML page for feature-phone
 * browsers. Links get accesskeys 1-9 (Home is 0); "More" and Home sit in a footer.
 */
export function toLite(deck: Deck, pf: ProfileId = DEFAULT_PROFILE): string {
  const cards = Array.isArray(deck.cards) ? deck.cards : [];
  let key = 0;
  const link = (l: Pick<Link, "label" | "href">, fallback: string): string => {
    const k = KEYS[key++];
    const label = e(String(typeof l.label === "string" ? l.label : "").replace(/^\d+\s+/, "")) || fallback;
    return `<a href="${e(mapHref(l.href, "/lite", pf))}"${k ? ` accesskey="${k}"` : ""}>${k ? `${k} ` : ""}${label}</a>`;
  };
  let more = "";
  let lastTitle = "";
  const body: string[] = [];
  for (const card of cards) {
    const links = Array.isArray(card.links) ? card.links : [];
    if (card.id === "more" && links[0]) {
      more = links[0].href;
      continue;
    }
    const parts: string[] = [];
    const title = e(card.title);
    if (title && title !== lastTitle) parts.push(`<b>${title}</b>`);
    lastTitle = title;
    for (const l of Array.isArray(card.lines) ? card.lines : []) parts.push(e(l));
    for (const l of links) parts.push(link(l ?? { label: "", href: "/" }, "?"));
    if (card.input) {
      const pfField = pf !== DEFAULT_PROFILE ? `<input type="hidden" name="pf" value="${e(pf)}">` : "";
      parts.push(`<form action="${e(mapHref(card.input.action, "/lite"))}" method="get"><input name="q" maxlength="40"> <input type="submit" value="OK">${pfField}</form>`);
    }
    if (parts.length) body.push(`<p>${parts.join("<br>")}</p>`);
  }
  const footer = [more ? link({ label: "More >", href: more }, "More") : "", `<a href="${e(mapHref("/", "/lite", pf))}" accesskey="0">0 Home</a>`];
  const pageTitle = e(cards[0]?.title) || "Revenant";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${pageTitle}</title></head><body>${body.join("")}<hr>${footer.filter(Boolean).join(" | ")}</body></html>`;
}
