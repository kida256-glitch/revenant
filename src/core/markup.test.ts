import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { XMLValidator } from "fast-xml-parser";
import { menuCards, pageDeck } from "./budget";
import { mapHref } from "./markup";
import { PROFILES, type Deck, type ProfileId } from "./types";
import { toWml } from "./wml";

const hostile = fc.oneof(
  fc.string({ maxLength: 80 }),
  fc.string({ unit: "binary", maxLength: 80 }),
  fc.constantFrom("<script>alert(1)</script>", "a&b<c>\"'$(x)$$", "]]><!--", "\u0000\u0007\u001b\u202e", "\uD800x", "javascript:alert(1)", "//evil.com/x", "/\\evil.com", "set:profile=generic", "/wiki/a/A%20B?p=2", ""),
);
const anyVal = fc.oneof(hostile, fc.anything());
const linkArb = fc.record({ label: anyVal, href: anyVal });
const cardArb = fc.record(
  { id: anyVal, title: anyVal, lines: fc.array(anyVal, { maxLength: 6 }), links: fc.array(linkArb, { maxLength: 6 }), input: fc.option(fc.record({ name: anyVal, action: anyVal }), { nil: undefined }) },
  { requiredKeys: ["id", "title", "lines", "links"] },
);
const deckArb = fc.record({ path: anyVal, cards: fc.array(cardArb, { maxLength: 5 }) }) as unknown as fc.Arbitrary<Deck>;
const pfArb = fc.constantFrom<ProfileId>("nokia3310", "generic");

const unescape = (s: string) => s.replace(/&amp;/g, "&").replace(/\$\$/g, "$");
const SAFE_PATH = /^\/wml(\/[A-Za-z0-9\-._~%!$&'()*+,;=:@/]*)?(\?[A-Za-z0-9\-._~%!$&'()*+,;=:@/?]*)?$/;
const hrefs = (xml: string) => [...xml.matchAll(/href="([^"]*)"/g)].map((m) => unescape(m[1] ?? ""));

describe("WML 1.1 serializer", () => {
  it("property: hostile decks give well-formed XML, no control chars, only /wml or #card targets", () => {
    fc.assert(
      fc.property(deckArb, pfArb, (deck, pf) => {
        const xml = toWml(deck, pf);
        expect(XMLValidator.validate(xml)).toBe(true);
        expect(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/.test(xml)).toBe(false);
        for (const h of hrefs(xml)) {
          expect(/^#c\d+$/.test(h) || (SAFE_PATH.test(h) && !h.startsWith("/wml//"))).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("maps app links, profiles and external links", () => {
    expect(mapHref("/", "/wml")).toBe("/wml");
    expect(mapHref("/wiki/a/A%20B?p=2", "/wml", "generic")).toBe("/wml/wiki/a/A%20B?p=2&pf=generic");
    expect(mapHref("set:profile=generic", "/wml")).toBe("/wml/settings?pf=generic");
    expect(mapHref("https://evil.com", "/wml")).toBe("/wml");
    expect(mapHref("//evil.com", "/wml")).toBe("/wml");
  });

  it("renders a real menu deck as cards with links", () => {
    const p = PROFILES.nokia3310;
    const deck = pageDeck(menuCards("Revenant", "", [{ label: "1 Wikipedia", href: "/wiki" }], p), 0, () => "/", p);
    const xml = toWml(deck);
    expect(xml).toContain("WML 1.1");
    expect(xml).toContain('<a href="/wml/wiki">1 Wikipedia</a>');
  });
});
