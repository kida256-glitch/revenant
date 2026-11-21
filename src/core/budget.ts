import { fitLine, paginate, wrap, bodyRows } from "./fit";
import { sanitize } from "./sanitize";
import type { Card, Deck, Link, Profile } from "./types";

export const CARD_MAX = 1000;
export const DECK_MAX = 1400;
/** Packing target, leaves room for the deck envelope and a "More" card. */
export const CARD_TARGET = 700;
export const MAX_PATH = 200;

const enc = new TextEncoder();

export function utf8Length(s: string): number {
  return enc.encode(s).length;
}

export function bytes(x: unknown): number {
  return utf8Length(JSON.stringify(x));
}

/** Screen rows a card uses below its title. Link labels wrap at cols-1 (1 col for the cursor). */
export function cardRows(card: Card, profile: Profile): number {
  let n = card.lines.length + (card.input ? 1 : 0);
  for (const l of card.links) n += wrap(l.label, profile.cols - 1).length || 1;
  return n;
}

export function validCard(card: Card, profile: Profile): boolean {
  return (
    typeof card.title === "string" &&
    card.title.length <= profile.cols &&
    card.lines.every((l) => typeof l === "string" && l.length <= profile.cols) &&
    card.links.every((l) => l.href.length <= MAX_PATH && l.href.length > 0) &&
    cardRows(card, profile) <= bodyRows(profile) &&
    bytes(card) <= CARD_MAX
  );
}

export function validDeck(deck: Deck, profile: Profile): boolean {
  return (
    deck.cards.length > 0 &&
    deck.path.length <= MAX_PATH &&
    deck.cards.every((c) => validCard(c, profile)) &&
    bytes(deck) <= DECK_MAX
  );
}

export function safePath(path: unknown): string {
  return typeof path === "string" && path.startsWith("/") && path.length <= MAX_PATH ? path : "/";
}

function fitLabel(label: string, profile: Profile): string {
  const max = bodyRows(profile) * (profile.cols - 1);
  return fitLine(sanitize(label, 200), Math.min(max, 60)) || "?";
}

/**
 * Build cards holding intro text then links, splitting across cards by rows
 * and bytes. Links with over-long hrefs are replaced by a visible note.
 */
export function menuCards(
  title: string,
  intro: string,
  links: Link[],
  profile: Profile,
  opts: { input?: Card["input"]; idPrefix?: string } = {},
): Card[] {
  const prefix = opts.idPrefix ?? "m";
  const cards = intro ? paginate(title, intro, profile, prefix) : [];
  let cur: Card = cards.pop() ?? { id: `${prefix}0`, title: fitLine(title, profile.cols), lines: [], links: [] };
  if (opts.input) {
    if (cardRows(cur, profile) + 1 > bodyRows(profile)) {
      cards.push(cur);
      cur = { id: `${prefix}${cards.length}`, title: cur.title, lines: [], links: [] };
    }
    cur.input = opts.input;
  }
  for (const raw of links) {
    const link: Link = raw.href.length <= MAX_PATH
      ? { label: fitLabel(raw.label, profile), href: raw.href }
      : { label: fitLabel("(link too long)", profile), href: "/" };
    const trial: Card = { ...cur, links: [...cur.links, link] };
    if (cardRows(trial, profile) <= bodyRows(profile) && bytes(trial) <= CARD_TARGET) {
      cur = trial;
    } else {
      cards.push(cur);
      cur = { id: `${prefix}${cards.length}`, title: cur.title, lines: [], links: [link] };
    }
  }
  cards.push(cur);
  return cards.map((c, i) => ({ ...c, id: `${prefix}${i}` }));
}

function moreCard(href: string, profile: Profile): Card {
  return { id: "more", title: fitLine("More", profile.cols), lines: [], links: [{ label: "More >", href }] };
}

/**
 * Pack cards into decks within DECK_MAX. Every deck but the last ends with a
 * "More" card linking to the next deck. Returns deck number `p` (clamped).
 */
export function pageDeck(cards: Card[], p: number, pathFor: (p: number) => string, profile: Profile): Deck {
  const groups: Card[][] = [];
  let cur: Card[] = [];
  for (const card of cards) {
    const trial = { path: pathFor(groups.length), cards: [...cur, card, moreCard(pathFor(groups.length + 1), profile)] };
    if (cur.length > 0 && bytes(trial) > DECK_MAX) {
      groups.push(cur);
      cur = [card];
    } else cur.push(card);
  }
  if (cur.length) groups.push(cur);
  if (groups.length === 0) groups.push([]);
  const idx = Math.min(Math.max(0, Math.floor(Number.isFinite(p) ? p : 0)), groups.length - 1);
  const group = groups[idx] ?? [];
  const out = idx < groups.length - 1 ? [...group, moreCard(pathFor(idx + 1), profile)] : group;
  return { path: pathFor(idx), cards: out.length ? out : [errorCard("Empty", profile)] };
}

function errorCard(text: string, profile: Profile): Card {
  return { id: "e0", title: fitLine("Revenant", profile.cols), lines: wrap(text, profile.cols).slice(0, bodyRows(profile) - 2), links: [] };
}

function messageDeck(path: string, title: string, text: string, links: Link[], profile: Profile): Deck {
  const p = safePath(path);
  return { path: p, error: true, cards: menuCards(title, text, links, profile, { idPrefix: "e" }).slice(0, 4) };
}

export function unavailableDeck(path: unknown, source: string, profile: Profile): Deck {
  const p = safePath(path);
  return messageDeck(p, "Unavailable", `${sanitize(source, 30)} service unavailable, try again.`, [
    { label: "Try again", href: p },
    { label: "Home", href: "/" },
  ], profile);
}

export function notFoundDeck(path: unknown, profile: Profile): Deck {
  return messageDeck(safePath(path), "Not found", "No such page.", [{ label: "Home", href: "/" }], profile);
}

/** Last line of defense: a deck that fails validation becomes an error deck. */
export function finalize(deck: Deck, profile: Profile): Deck {
  if (validDeck(deck, profile)) return deck;
  return messageDeck("/", "Error", "Page too big or broken.", [{ label: "Home", href: "/" }], profile);
}

/** Response body `{deck, bytes}` where bytes is the body's own UTF-8 length. */
export function envelope(deck: Deck): { body: string; bytes: number } {
  let n = 0;
  let body = JSON.stringify({ deck, bytes: n });
  for (let i = 0; i < 6; i++) {
    const m = utf8Length(body);
    if (m === n) break;
    n = m;
    body = JSON.stringify({ deck, bytes: n });
  }
  return { body, bytes: n };
}
