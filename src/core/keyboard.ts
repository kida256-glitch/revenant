import type { Key } from "./t9";

export type KeyAction = { type: "key"; key: Key } | { type: "char"; ch: string } | null;

export interface KeyInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** True when focus is in a real text field (input, textarea, select, contenteditable). */
  editable?: boolean;
}

const NAMED: Record<string, Key> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  Enter: "select", Backspace: "softR", Escape: "back", "*": "*", "#": "#",
};

/**
 * Map a laptop key press to a phone action. Digits, * and # are keypad keys;
 * letters (and space) type directly into a text input, bypassing T9, when the
 * card has one. Returns null for keys the phone should not capture.
 */
export function mapKeyboard(e: KeyInput, hasInput: boolean): KeyAction {
  if (e.editable || e.ctrlKey || e.metaKey || e.altKey) return null;
  if (/^[0-9]$/.test(e.key)) return { type: "key", key: e.key as Key };
  const named = NAMED[e.key];
  if (named) return { type: "key", key: named };
  if (hasInput && /^[A-Za-z ]$/.test(e.key)) return { type: "char", ch: e.key };
  return null;
}
