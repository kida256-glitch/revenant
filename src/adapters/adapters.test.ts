import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { validDeck } from "@/core/budget";
import { PROFILES } from "@/core/types";
import { parseAsk, parseRates, parseWeather, parseWikiArticle, parseWikiSearch } from "./parse";
import { resolveDeck } from "./router";

const profileArb = fc.constantFrom(...Object.values(PROFILES));
const huge = "Lorem <b>ipsum</b> \u0000dolor &amp; sit\u001b amet ".repeat(4000);
const hostileStr = fc.oneof(
  fc.string({ maxLength: 500 }),
  fc.string({ unit: "binary", maxLength: 500 }),
  fc.constantFrom(huge, "<script>alert(1)</script>", "&lt;img onerror=x&gt;", "\u202e\u0007\u0000", ""),
);
const hostileVal = fc.oneof(hostileStr, fc.anything(), fc.double(), fc.integer());
const hostileJson = fc.oneof(
  fc.anything(),
  fc.record({ pages: fc.array(fc.record({ title: hostileVal, description: hostileVal }), { maxLength: 8 }) }),
  fc.record({ query: fc.record({ pages: fc.array(fc.record({ title: hostileVal, extract: hostileVal }), { maxLength: 2 }) }) }),
  fc.record({ title: hostileVal, extract: hostileVal }),
  fc.record({
    current: fc.record({ temperature_2m: hostileVal, weather_code: hostileVal, wind_speed_10m: hostileVal }),
    daily: fc.record({ time: fc.array(hostileVal), temperature_2m_max: fc.array(hostileVal), temperature_2m_min: fc.array(hostileVal), precipitation_probability_max: fc.array(hostileVal) }),
  }),
  fc.record({ rates: fc.dictionary(fc.constantFrom("UGX", "USD", "EUR", "GBP", "KES"), hostileVal), time_last_update_utc: hostileVal }),
);
const paths = fc.constantFrom("/wiki/search?q=nile", "/wiki/a/Kampala", "/wiki/a/Kampala?p=3", "/weather/gulu", "/money", "/ask/q?q=who", "/", "/about/rates");

describe("property 4: parsers and router", () => {
  it("hostile JSON always yields a valid in-budget deck and never throws", () => {
    fc.assert(
      fc.property(hostileJson, hostileStr, profileArb, (json, s, profile) => {
        const decks = [
          parseWikiSearch(json, s, "/wiki/search?q=x", profile),
          parseWikiArticle(json, s || "X", 0, profile),
          parseWikiArticle(json, "X", 7, profile),
          parseAsk(json, s, "/ask/q?q=x", profile),
          parseWeather(json, s, "/weather/gulu", profile),
          parseRates(json, "/money", profile),
        ];
        for (const d of decks) expect(validDeck(d, profile)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("router returns valid decks for hostile upstream JSON, failures and arbitrary paths", async () => {
    await fc.assert(
      fc.asyncProperty(fc.oneof(paths, fc.string({ maxLength: 250 }), fc.anything()), hostileJson, fc.boolean(), profileArb, async (path, json, fail, profile) => {
        const get = async () => {
          if (fail) throw new Error("down");
          return { json, stale: false };
        };
        const r = await resolveDeck(path, profile, get);
        expect(validDeck(r.deck, profile)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("upstream failure without cache returns a service unavailable deck", async () => {
    const r = await resolveDeck("/money", PROFILES.nokia3310, async () => { throw new Error("timeout"); });
    expect(r.status).toBe(503);
    expect(r.deck.cards[0]?.title).toBe("Unavailable");
    expect(r.deck.cards.flatMap((c) => c.links).map((l) => l.label)).toContain("Try again");
  });

  it("parses rates into UGX lines with as-of time", () => {
    const d = parseRates({ rates: { USD: 1, UGX: 3700, EUR: 0.9, GBP: 0.8, KES: 129 }, time_last_update_utc: "Fri, 14 Nov 2026 00:02:31 +0000" }, "/money", PROFILES.generic);
    const text = d.cards.flatMap((c) => c.lines).join(" ");
    expect(text).toContain("1 USD = 3,700 UGX.");
    expect(text).toContain("2026-11-14 00:02 UTC");
  });
});
