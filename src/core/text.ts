import { bytes, CARD_MAX, DECK_MAX, envelope } from "./budget";
import type { Deck } from "./types";

/** Plain-text rendering of a deck: one block per card, links numbered. */
export function deckText(deck: Deck): string {
  return deck.cards
    .map((c, i) => {
      const out = [`[${i + 1}/${deck.cards.length}] ${c.title}`, ...c.lines];
      if (c.input) out.push(`(input: ${c.input.action}?q=...)`);
      c.links.forEach((l, j) => out.push(`  ${j + 1}) ${l.label} -> ${l.href}`));
      return out.join("\n");
    })
    .join("\n\n");
}

export interface DeckMeasure {
  responseBytes: number;
  deckBytes: number;
  cards: number;
  largestCardBytes: number;
  fitsCardBudget: boolean;
  fitsDeckBudget: boolean;
  cardMax: number;
  deckMax: number;
}

/** Sizes as served by /api/deck (uncompressed UTF-8) and budget checks. */
export function measureDeck(deck: Deck): DeckMeasure {
  const largest = Math.max(0, ...deck.cards.map((c) => bytes(c)));
  const deckBytes = bytes(deck);
  return {
    responseBytes: envelope(deck).bytes,
    deckBytes,
    cards: deck.cards.length,
    largestCardBytes: largest,
    fitsCardBudget: largest <= CARD_MAX,
    fitsDeckBudget: deckBytes <= DECK_MAX,
    cardMax: CARD_MAX,
    deckMax: DECK_MAX,
  };
}
