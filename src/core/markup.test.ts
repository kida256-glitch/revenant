import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { XMLValidator } from "fast-xml-parser";
import { menuCards, pageDeck, utf8Length } from "./budget";
import { paginate } from "./fit";
import { LITE_MAX, toLite } from "./lite";
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

const unescape = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\$\$/g, "$");
const SAFE_PATH = /^\/wml(\/[A-Za-z0-9\-._~%!$&'()*+,;=:@/]*)?(\?[A-Za-z0-9\-._~%!$&'()*+,;=:@/?]*)?$/;
const hrefs = (xml: string) => [...xml.matchAll(/href="([^"]*)"/g)].map((m) => unescape(m[1] ?? ""));

const TAGS = new Set(["html", "head", "meta", "title", "body", "p", "b", "br", "a", "form", "input", "hr"]);
const ATTRS = new Set(["lang", "charset", "name", "content", "href", "accesskey", "action", "method", "type", "value", "maxlength"]);

describe("lite HTML serializer", () => {
  it("property: no script/img/handlers, only allowed tags, unique accesskeys, text escaped", () => {
    fc.assert(
      fc.property(deckArb, pfArb, (deck, pf) => {
        const html = toLite(deck, pf);
        expect(/<\s*(script|img)/i.test(html)).toBe(false);
        expect(/&(?!(amp|lt|gt|quot|#39);)/.test(html)).toBe(false);
        for (const m of html.replace("<!DOCTYPE html>", "").matchAll(/<\/?([^\s>/]+)([^>]*)>/g)) {
          expect(TAGS.has(m[1] ?? "")).toBe(true);
          for (const a of (m[2] ?? "").matchAll(/\s([^\s=]+)=/g)) expect(ATTRS.has(a[1] ?? "")).toBe(true);
        }
        const keys = [...html.matchAll(/accesskey="([^"]*)"/g)].map((m) => m[1]);
        expect(new Set(keys).size).toBe(keys.length);
        expect(html).toContain('accesskey="0">0 Home</a>');
      }),
      { numRuns: 300 },
    );
  });

  it("property: real paginated article decks stay under 3 KB", () => {
    const words = fc.array(fc.constantFrom("Kampala", "is", "the", "capital", "of", "Uganda", "&", "<b>", "Lake", "Victoria", "1962."), { minLength: 1, maxLength: 1500 });
    fc.assert(
      fc.property(words, fc.constantFrom(...Object.values(PROFILES)), fc.nat(5), (w, p, page) => {
        const deck = pageDeck(paginate("Kampala", w.join(" "), p, "a"), page, (n) => `/wiki/a/Kampala?p=${n}`, p);
        expect(utf8Length(toLite(deck, p.id))).toBeLessThan(LITE_MAX);
      }),
      { numRuns: 100 },
    );
  });
});

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

it("percent-encodes RFC 3986-illegal path characters (found by property test)", () => {
  expect(mapHref("/]", "/wml")).toBe("/wml/%5D");
});
