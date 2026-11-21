import { cleanText, escapeXml, mapHref } from "./markup";
import { DEFAULT_PROFILE, type Deck, type ProfileId } from "./types";

export const WML_TYPE = "text/vnd.wap.wml; charset=utf-8";

/** WML text: XML-escaped, and `$` doubled (WML variable syntax). */
const t = (s: unknown): string => escapeXml(s).replace(/\$/g, "$$$$");
const attr = (href: string): string => t(href);

/**
 * Serialize a deck to a WML 1.1 document: one <card> per screen, links as
 * <a>, a "Next" link between screens, inputs submitted with <go method="get">.
 */
export function toWml(deck: Deck, pf: ProfileId = DEFAULT_PROFILE): string {
  const cards = Array.isArray(deck.cards) ? deck.cards : [];
  const out: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE wml PUBLIC "-//WAPFORUM//DTD WML 1.1//EN" "http://www.wapforum.org/DTD/wml_1.1.xml">',
    "<wml>",
  ];
  if (cards.length === 0) out.push('<card id="c0" title="Revenant"><p><a href="/wml">Home</a></p></card>');
  cards.forEach((card, i) => {
    const lines = Array.isArray(card.lines) ? card.lines : [];
    const links = Array.isArray(card.links) ? card.links : [];
    const body: string[] = lines.map((l) => t(l));
    if (card.input) {
      const action = mapHref(card.input.action, "/wml");
      const pfField = pf !== DEFAULT_PROFILE ? `<postfield name="pf" value="${t(pf)}"/>` : "";
      body.push(`<input name="q" maxlength="40"/>`);
      body.push(`<anchor>OK<go href="${attr(action)}" method="get"><postfield name="q" value="$(q)"/>${pfField}</go></anchor>`);
    }
    for (const l of links) body.push(`<a href="${attr(mapHref(l?.href, "/wml", pf))}">${t(l?.label) || "?"}</a>`);
    if (i < cards.length - 1) body.push(`<a href="#c${i + 1}">Next &gt;</a>`);
    out.push(`<card id="c${i}" title="${t(cleanText(card.title).slice(0, 40))}">`);
    out.push(`<p>${body.join("<br/>")}</p>`);
    out.push("</card>");
  });
  out.push("</wml>");
  return out.join("\n");
}
