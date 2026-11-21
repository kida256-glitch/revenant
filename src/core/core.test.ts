import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { paginate, unwrap } from "./fit";
import { sanitize } from "./sanitize";
import { bytes, CARD_MAX, envelope, unavailableDeck, utf8Length, validCard, validDeck } from "./budget";
import { ALL_KEYS, emptyKeypad, keypadReduce, MAX_INPUT, multitapEncode, T9_WORDS, t9Encode, typeKeys } from "./t9";
import { currentPath, initialNav, isValidNav, navLoaded, navReduce, type NavState } from "./nav";
import { PROFILES, type Deck, type ProfileId } from "./types";

const profileArb = fc.constantFrom(...Object.values(PROFILES));
const keyArb = fc.constantFrom(...ALL_KEYS);
const hostileText = fc.oneof(
  fc.string({ maxLength: 3000 }),
  fc.string({ unit: "binary", maxLength: 3000 }),
  fc.array(fc.constantFrom("<b>", "</p>", "&amp;", "\u0000", "\u001b[31m", "word", "supercalifragilisticexpialidocious", " ", "\n", "caf\u00e9", "--", "a-"), { maxLength: 400 }).map((a) => a.join("")),
);

describe("property 1: pagination", () => {
  it("fits profile and budget, preserves words in order", () => {
    fc.assert(
      fc.property(hostileText, fc.string({ maxLength: 50 }), profileArb, (raw, rawTitle, profile) => {
        const text = sanitize(raw);
        const cards = paginate(sanitize(rawTitle), text, profile);
        for (const c of cards) {
          expect(validCard(c, profile)).toBe(true);
          expect(bytes(c)).toBeLessThanOrEqual(CARD_MAX);
        }
        const rejoined = unwrap(cards.flatMap((c) => c.lines), profile.cols);
        expect(rejoined.split(" ").filter(Boolean)).toEqual(text.split(" ").filter(Boolean));
      }),
      { numRuns: 300 },
    );
  });

  it("sanitize strips markup and control characters", () => {
    expect(sanitize("<script>x()</script><b>Hi</b>&amp;\u0007 there")).toBe("Hi & there");
    expect(sanitize(42)).toBe("");
  });
});

describe("property 2: T9 and multitap", () => {
  it("multitap round trip", () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789 .,?!'-";
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...chars), { maxLength: MAX_INPUT }).map((a) => a.join("")), (text) => {
        expect(typeKeys(multitapEncode(text), "abc")).toBe(text);
      }),
    );
  });

  it("T9 round trip for dictionary words", () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...T9_WORDS), { minLength: 1, maxLength: 4 }), (words) => {
        const text = words.join(" ");
        fc.pre(text.length <= MAX_INPUT);
        expect(typeKeys(t9Encode(text), "t9")).toBe(text);
      }),
    );
  });

  it("keypad never throws and stays within MAX_INPUT", () => {
    fc.assert(
      fc.property(fc.array(fc.oneof(keyArb, fc.constant("delete" as const)), { maxLength: 300 }), fc.constantFrom("t9" as const, "abc" as const), (keys, mode) => {
        const s = keys.reduce(keypadReduce, emptyKeypad(mode));
        expect(typeKeys([], mode)).toBe("");
        expect(s.text.length).toBeLessThanOrEqual(MAX_INPUT);
      }),
    );
  });
});

describe("property 3: navigation", () => {
  const mkDeck = (path: string, seed: number): Deck => ({
    path,
    cards: Array.from({ length: (seed % 3) + 1 }, (_, i) => ({
      id: `c${i}`,
      title: "T",
      lines: ["x"],
      links: [
        { label: "1 A", href: `/a${seed % 5}` },
        { label: "2 B", href: `/b${i}` },
        { label: "Set", href: seed % 2 ? "set:profile=generic" : "set:profile=bogus" },
      ],
      input: seed % 4 === 0 ? { name: "q", action: "/wiki/search" } : undefined,
    })),
  });

  it("any key sequence keeps a valid state; Back returns to the previous page", () => {
    fc.assert(
      fc.property(fc.array(keyArb, { maxLength: 200 }), fc.constantFrom<ProfileId>("nokia3310", "generic"), fc.nat(), (keys, profile, seed) => {
        let { state } = initialNav(profile);
        state = navLoaded(state, mkDeck("/", seed));
        let i = 0;
        for (const key of keys) {
          const before: NavState = state;
          const res = navReduce(state, key);
          state = res.state;
          if (key === "back" && before.history.length > 1) {
            expect(currentPath(state)).toBe(before.history[before.history.length - 2]);
          }
          if (res.effect?.type === "load") state = navLoaded(state, mkDeck(res.effect.path, seed + ++i));
          expect(isValidNav(state)).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe("budget helpers", () => {
  it("envelope bytes equal the real UTF-8 body length", () => {
    const deck = unavailableDeck("/money", "Rates", PROFILES.nokia3310);
    const { body, bytes: n } = envelope(deck);
    expect(n).toBe(utf8Length(body));
    expect(validDeck(deck, PROFILES.nokia3310)).toBe(true);
  });
});
