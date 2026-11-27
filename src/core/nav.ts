import { emptyKeypad, keypadReduce, keypadText, type Key, type KeypadState } from "./t9";
import { isProfileId, type Card, type Deck, type ProfileId } from "./types";

export interface NavState {
  /** Visited paths; last is current. Never empty, history[0] is "/". */
  history: string[];
  deck: Deck | null;
  card: number;
  focus: number;
  keypad: KeypadState;
  profile: ProfileId;
}

export type Effect = { type: "load"; path: string } | { type: "profile"; id: ProfileId } | { type: "open"; url: string };

export interface NavResult {
  state: NavState;
  effect?: Effect;
}

const MAX_HISTORY = 30;

export function initialNav(profile: ProfileId): NavResult {
  return {
    state: { history: ["/"], deck: null, card: 0, focus: 0, keypad: emptyKeypad(), profile },
    effect: { type: "load", path: "/" },
  };
}

export function currentPath(s: NavState): string {
  return s.history[s.history.length - 1] ?? "/";
}

export function currentCard(s: NavState): Card | undefined {
  return s.deck?.cards[s.card];
}

/** Focusable items: the input (if any) then each link. */
export function itemCount(card: Card | undefined): number {
  if (!card) return 0;
  return (card.input ? 1 : 0) + card.links.length;
}

export function isValidNav(s: NavState): boolean {
  const card = currentCard(s);
  const n = itemCount(card);
  return (
    s.history.length >= 1 &&
    s.history.length <= MAX_HISTORY &&
    s.history[0] === "/" &&
    s.history.every((p) => p.startsWith("/")) &&
    isProfileId(s.profile) &&
    (s.deck === null ? s.card === 0 : s.card >= 0 && s.card < s.deck.cards.length) &&
    s.focus >= 0 &&
    (n === 0 ? s.focus === 0 : s.focus < n)
  );
}

/** Apply a loaded deck for the current path. */
export function navLoaded(s: NavState, deck: Deck): NavState {
  return { ...s, deck: deck.cards.length ? deck : null, card: 0, focus: 0, keypad: emptyKeypad(s.keypad.mode) };
}

function go(s: NavState, path: string): NavResult {
  const trimmed = [...s.history, path];
  const history = trimmed.length > MAX_HISTORY ? ["/", ...trimmed.slice(-(MAX_HISTORY - 1))] : trimmed;
  return { state: { ...s, history, deck: null, card: 0, focus: 0 }, effect: { type: "load", path } };
}

function back(s: NavState): NavResult {
  if (s.history.length <= 1) return { state: s };
  const history = s.history.slice(0, -1);
  const path = history[history.length - 1] ?? "/";
  return { state: { ...s, history, deck: null, card: 0, focus: 0 }, effect: { type: "load", path } };
}

function follow(s: NavState, href: string): NavResult {
  if (href.startsWith("set:profile=")) {
    const id = href.slice("set:profile=".length);
    if (isProfileId(id)) return { state: { ...s, profile: id }, effect: { type: "profile", id } };
    return { state: s };
  }
  // External links (e.g. the block explorer on /about/proof) open outside the phone.
  if (href.startsWith("https://")) return { state: s, effect: { type: "open", url: href } };
  if (!href.startsWith("/")) return { state: s };
  return go(s, href);
}

function select(s: NavState, card: Card): NavResult {
  const hasInput = card.input !== undefined;
  if (hasInput && s.focus === 0) {
    const q = keypadText(s.keypad).trim();
    if (!q || !card.input) return { state: s };
    return go({ ...s, keypad: emptyKeypad(s.keypad.mode) }, `${card.input.action}?q=${encodeURIComponent(q)}`);
  }
  const link = card.links[s.focus - (hasInput ? 1 : 0)];
  return link ? follow(s, link.href) : { state: s };
}

/** Navigation reducer. Pure; the caller performs the returned effect. */
export function navReduce(s: NavState, key: Key): NavResult {
  const card = currentCard(s);
  if (!card || !s.deck) return key === "back" || key === "softR" ? back(s) : { state: s };
  const n = itemCount(card);
  const hasInput = card.input !== undefined;
  const typing = hasInput && keypadText(s.keypad).length + s.keypad.seq.length > 0;

  switch (key) {
    case "up":
      return { state: { ...s, focus: Math.max(0, s.focus - 1) } };
    case "down":
      return { state: { ...s, focus: Math.min(Math.max(0, n - 1), s.focus + 1) } };
    case "left":
      return { state: { ...s, card: Math.max(0, s.card - 1), focus: 0 } };
    case "right":
      return { state: { ...s, card: Math.min(s.deck.cards.length - 1, s.card + 1), focus: 0 } };
    case "select":
    case "softL":
      return select(s, card);
    case "softR":
      return typing ? { state: { ...s, keypad: keypadReduce(s.keypad, "delete") } } : back(s);
    case "back":
      return back(s);
    default:
      if (hasInput) return { state: { ...s, focus: 0, keypad: keypadReduce(s.keypad, key) } };
      if (key >= "1" && key <= "9") {
        for (const c of s.deck.cards) {
          const link = c.links.find((l) => l.label.startsWith(`${key} `));
          if (link) return follow(s, link.href);
        }
        const link = card.links[Number(key) - 1];
        if (link) return follow(s, link.href);
      }
      return { state: s };
  }
}
