export type Key =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "*" | "#"
  | "up" | "down" | "left" | "right" | "select" | "softL" | "softR" | "back";

export const ALL_KEYS: Key[] = [
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#",
  "up", "down", "left", "right", "select", "softL", "softR", "back",
];

export const MULTITAP: Record<string, string> = {
  "0": " 0", "1": ".,?!'-1", "2": "abc2", "3": "def3", "4": "ghi4", "5": "jkl5",
  "6": "mno6", "7": "pqrs7", "8": "tuv8", "9": "wxyz9",
};

export const MAX_INPUT = 40;

const DICT = (
  "the of and to in is was for on as by with he at from his it an are be this which or had " +
  "who what where when why how not but first new one two three city capital country people " +
  "uganda kampala gulu jinja mbarara entebbe kenya nairobi tanzania rwanda africa east nile lake " +
  "victoria river mountain president history music football weather rain money bank school " +
  "health water food farm coffee tea maize market phone mobile internet news radio language " +
  "english luganda swahili world war king queen god church time year day night is are"
).split(" ");

const LETTER_KEY: Record<string, string> = {};
for (const [k, letters] of Object.entries(MULTITAP)) {
  for (const ch of letters) if (!(ch in LETTER_KEY)) LETTER_KEY[ch] = k;
}

/** T9 digits for a lowercase a-z word. */
export function t9Digits(word: string): string {
  let out = "";
  for (const ch of word) {
    const k = LETTER_KEY[ch];
    if (k && k >= "2") out += k;
  }
  return out;
}

const DICT_BY_SEQ = new Map<string, string[]>();
for (const w of DICT) {
  const seq = t9Digits(w);
  const list = DICT_BY_SEQ.get(seq) ?? [];
  if (!list.includes(w)) list.push(w);
  DICT_BY_SEQ.set(seq, list);
}

export const T9_WORDS: readonly string[] = [...new Set(DICT)];

/** Candidates for a digit sequence: dictionary words, then a first-letter fallback. */
export function t9Candidates(seq: string): string[] {
  const words = [...(DICT_BY_SEQ.get(seq) ?? [])];
  const fallback = [...seq].map((d) => MULTITAP[d]?.[0] ?? "").join("");
  if (fallback && !words.includes(fallback)) words.push(fallback);
  return words;
}

export interface KeypadState {
  mode: "t9" | "abc";
  text: string;
  /** T9: digits of the word being composed. */
  seq: string;
  cycle: number;
  /** Multitap: key being tapped and tap count. */
  tapKey: string | null;
  tapCount: number;
}

export const emptyKeypad = (mode: KeypadState["mode"] = "t9"): KeypadState => ({
  mode, text: "", seq: "", cycle: 0, tapKey: null, tapCount: 0,
});

function composing(s: KeypadState): string {
  if (s.mode === "t9") {
    if (!s.seq) return "";
    const c = t9Candidates(s.seq);
    return c[s.cycle % Math.max(1, c.length)] ?? "";
  }
  if (s.tapKey === null) return "";
  const letters = MULTITAP[s.tapKey] ?? "";
  return letters[s.tapCount % Math.max(1, letters.length)] ?? "";
}

/** Text as shown, including the word or letter being composed. */
export function keypadText(s: KeypadState): string {
  return (s.text + composing(s)).slice(0, MAX_INPUT);
}

export function commit(s: KeypadState): KeypadState {
  return { ...s, text: keypadText(s), seq: "", cycle: 0, tapKey: null, tapCount: 0 };
}

function isDigit(k: Key): boolean {
  return k.length === 1 && k >= "0" && k <= "9";
}

/** Type a character directly (laptop keyboard), bypassing T9/multitap. */
export function keypadInsert(s: KeypadState, ch: string): KeypadState {
  const base = commit(s);
  return base.text.length >= MAX_INPUT ? base : { ...base, text: base.text + ch };
}

/** Keypad reducer. Keys other than digits, *, # and delete leave the state unchanged. */
export function keypadReduce(s: KeypadState, key: Key | "delete"): KeypadState {
  if (key === "#") return { ...commit(s), mode: s.mode === "t9" ? "abc" : "t9" };
  if (key === "delete") {
    if (s.mode === "t9" && s.seq) return { ...s, seq: s.seq.slice(0, -1), cycle: 0 };
    if (s.mode === "abc" && s.tapKey !== null) return { ...s, tapKey: null, tapCount: 0 };
    return { ...s, text: s.text.slice(0, -1) };
  }
  const full = keypadText(s).length >= MAX_INPUT;
  if (s.mode === "t9") {
    if (key === "*") return s.seq ? { ...s, cycle: (s.cycle + 1) % Math.max(1, t9Candidates(s.seq).length) } : s;
    if (key === "0") return full ? commit(s) : { ...commit(s), text: (keypadText(s) + " ").slice(0, MAX_INPUT) };
    if (key === "1") return full ? commit(s) : { ...commit(s), text: (keypadText(s) + ".").slice(0, MAX_INPUT) };
    if (isDigit(key)) {
      if (full && !s.seq) return s;
      if (s.seq.length >= MAX_INPUT - s.text.length) return s;
      return { ...s, seq: s.seq + key, cycle: 0 };
    }
    return s;
  }
  if (key === "*") return commit(s);
  if (isDigit(key)) {
    if (s.tapKey === key) {
      const n = (MULTITAP[key] ?? "").length || 1;
      return { ...s, tapCount: (s.tapCount + 1) % n };
    }
    const c = commit(s);
    if (keypadText(c).length >= MAX_INPUT) return c;
    return { ...c, tapKey: key, tapCount: 0 };
  }
  return s;
}

/** Key presses that type `text` in multitap mode (from an empty multitap state). */
export function multitapEncode(text: string): Key[] {
  const keys: Key[] = [];
  let prev: string | null = null;
  for (const ch of text) {
    const k = LETTER_KEY[ch];
    if (!k) continue;
    const idx = (MULTITAP[k] ?? "").indexOf(ch);
    if (prev === k) keys.push("*");
    for (let i = 0; i <= idx; i++) keys.push(k as Key);
    prev = k;
  }
  return keys;
}

/** Key presses that type space-separated dictionary words in T9 mode. */
export function t9Encode(text: string): Key[] {
  const keys: Key[] = [];
  text.split(" ").forEach((word, i) => {
    if (i > 0) keys.push("0");
    const seq = t9Digits(word);
    for (const d of seq) keys.push(d as Key);
    const idx = t9Candidates(seq).indexOf(word);
    for (let j = 0; j < idx; j++) keys.push("*");
  });
  return keys;
}

export function typeKeys(keys: Key[], mode: KeypadState["mode"]): string {
  return keypadText(commit(keys.reduce(keypadReduce, emptyKeypad(mode))));
}
