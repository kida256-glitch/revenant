"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { unavailableDeck } from "@/core/budget";
import { wrap } from "@/core/fit";
import { currentCard, currentPath, initialNav, navLoaded, navReduce, type NavState } from "@/core/nav";
import { keypadText, type Key } from "@/core/t9";
import { DEFAULT_PROFILE, isProfileId, PROFILES, type Card, type Deck, type ProfileId } from "@/core/types";

type Status = "loading" | "ok" | "offline" | "error";

const KEYPAD: { key: Key; sub: string }[] = [
  { key: "1", sub: ".,?" }, { key: "2", sub: "abc" }, { key: "3", sub: "def" },
  { key: "4", sub: "ghi" }, { key: "5", sub: "jkl" }, { key: "6", sub: "mno" },
  { key: "7", sub: "pqrs" }, { key: "8", sub: "tuv" }, { key: "9", sub: "wxyz" },
  { key: "*", sub: "next" }, { key: "0", sub: "space" }, { key: "#", sub: "T9/abc" },
];

const KEYBOARD: Record<string, Key> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  Enter: "select", Backspace: "softR", Escape: "back", "*": "*", "#": "#",
};

interface Row {
  text: string;
  kind: "title" | "line" | "link" | "focus" | "input" | "blank";
}

function rows(card: Card | undefined, s: NavState, cols: number, height: number): Row[] {
  if (!card) return [];
  const out: Row[] = [{ text: card.title, kind: "title" }];
  for (const l of card.lines) out.push({ text: l, kind: "line" });
  let item = 0;
  if (card.input) {
    const t = keypadText(s.keypad);
    const tail = t.slice(-(cols - 2));
    out.push({ text: `${tail}_`.padEnd(cols - 1, " "), kind: s.focus === 0 ? "focus" : "input" });
    item++;
  }
  for (const link of card.links) {
    const focused = s.focus === item++;
    wrap(link.label, cols - 1).forEach((part, i) => {
      out.push({ text: `${focused && i === 0 ? ">" : " "}${part}`, kind: focused ? "focus" : "link" });
    });
  }
  while (out.length < height) out.push({ text: "", kind: "blank" });
  return out.slice(0, height);
}

export default function Phone() {
  const [profile, setProfile] = useState<ProfileId>(DEFAULT_PROFILE);
  const [nav, setNav] = useState<NavState>(() => initialNav(DEFAULT_PROFILE).state);
  const [status, setStatus] = useState<Status>("loading");
  const [bytes, setBytes] = useState<number | null>(null);
  const [cached, setCached] = useState(false);
  const [session, setSession] = useState(0);
  const navRef = useRef(nav);
  const cache = useRef(new Map<string, { deck: Deck; bytes: number }>());

  const commit = useCallback((s: NavState) => {
    navRef.current = s;
    setNav(s);
  }, []);

  const load = useCallback(async (path: string, pid: ProfileId) => {
    const key = `${pid}|${path}`;
    const apply = (deck: Deck, n: number, fromCache: boolean, st: Status) => {
      if (currentPath(navRef.current) !== path) return;
      commit(navLoaded(navRef.current, deck));
      setBytes(n);
      setCached(fromCache);
      setStatus(st);
    };
    const hit = cache.current.get(key);
    if (hit) return apply(hit.deck, hit.bytes, true, hit.deck.offline ? "offline" : hit.deck.error ? "error" : "ok");
    setStatus("loading");
    try {
      const res = await fetch(`/api/deck?path=${encodeURIComponent(path)}&profile=${pid}`);
      const text = await res.text();
      const n = new TextEncoder().encode(text).length;
      const body = JSON.parse(text) as { deck?: Deck };
      const deck = body.deck;
      if (!deck || !Array.isArray(deck.cards) || deck.cards.length === 0) throw new Error("bad deck");
      setSession((x) => x + n);
      if (res.ok && !deck.offline) cache.current.set(key, { deck, bytes: n });
      apply(deck, n, false, deck.offline ? "offline" : deck.error ? "error" : "ok");
    } catch {
      apply(unavailableDeck(path, "Network", PROFILES[pid]), 0, false, "error");
    }
  }, [commit]);

  useEffect(() => {
    const saved = localStorage.getItem("revenant.profile");
    const pid = isProfileId(saved) ? saved : DEFAULT_PROFILE;
    setProfile(pid);
    const init = initialNav(pid);
    commit(init.state);
    void load("/", pid);
  }, [commit, load]);

  const press = useCallback((key: Key) => {
    const res = navReduce(navRef.current, key);
    commit(res.state);
    const eff = res.effect;
    if (eff?.type === "load") void load(eff.path, res.state.profile);
    if (eff?.type === "profile") {
      localStorage.setItem("revenant.profile", eff.id);
      setProfile(eff.id);
      void load(currentPath(res.state), eff.id);
    }
  }, [commit, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k: Key | undefined = /^[0-9]$/.test(e.key) ? (e.key as Key) : KEYBOARD[e.key];
      if (!k) return;
      e.preventDefault();
      press(k);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const p = PROFILES[profile];
  const card = currentCard(nav);
  const lcdRows = rows(card, nav, p.cols, p.rows);
  const typing = !!card?.input && keypadText(nav.keypad).length > 0;
  const total = nav.deck?.cards.length ?? 0;

  return (
    <div className="phone">
      <div className="brand">
        <span className="ghost" aria-hidden>👻</span> REVENANT
      </div>
      <div className="screen-wrap">
        <div className="statusbar">
          <span>{p.name}</span>
          <span>{card?.input ? (nav.keypad.mode === "t9" ? "T9" : "abc") : total > 1 ? `${nav.card + 1}/${total}` : ""}</span>
        </div>
        <div
          className={`lcd ${p.id === "generic" ? "lcd-generic" : ""}`}
          style={{ width: `${p.cols}ch`, height: `${p.rows * 1.25}em` }}
          role="region"
          aria-label="Phone screen"
          aria-live="polite"
        >
          {status === "loading" && !card ? (
            <div className="lcd-row">Loading...</div>
          ) : (
            lcdRows.map((r, i) => (
              <div key={i} className={`lcd-row ${r.kind === "title" || r.kind === "focus" ? "inv" : ""}`}>
                {r.text || "\u00a0"}
              </div>
            ))
          )}
        </div>
        <div className="softkeys">
          <span>{card?.input && nav.focus === 0 ? "OK" : "Select"}</span>
          <span>{typing ? "Clear" : "Back"}</span>
        </div>
      </div>

      <div className="meter" aria-live="polite">
        <div>
          Deck: <b>{status === "loading" ? "..." : bytes === null ? "-" : `${bytes.toLocaleString()} B`}</b>
          {cached && status !== "loading" ? " (cached, 0 B used)" : ""}
          {status === "offline" && <span className="badge">OFFLINE</span>}
          {status === "error" && <span className="badge">ERROR</span>}
        </div>
        <div className="meter-sub">Real UTF-8 size of the response body, uncompressed. Session: {session.toLocaleString()} B</div>
      </div>

      <div className="controls">
        <button className="soft" onClick={() => press("softL")} aria-label="Left softkey">—</button>
        <div className="dpad">
          <button className="d-up" onClick={() => press("up")} aria-label="Up">▲</button>
          <button className="d-left" onClick={() => press("left")} aria-label="Previous card">◀</button>
          <button className="d-ok" onClick={() => press("select")} aria-label="Select">OK</button>
          <button className="d-right" onClick={() => press("right")} aria-label="Next card">▶</button>
          <button className="d-down" onClick={() => press("down")} aria-label="Down">▼</button>
        </div>
        <button className="soft" onClick={() => press("softR")} aria-label="Right softkey">—</button>
      </div>

      <div className="keypad">
        {KEYPAD.map(({ key, sub }) => (
          <button key={key} onClick={() => press(key)} aria-label={`Key ${key}`}>
            <span className="k">{key}</span>
            <span className="s">{sub}</span>
          </button>
        ))}
      </div>
      <p className="hint">Keyboard: arrows, Enter, Backspace, Esc, 0-9 * #</p>
    </div>
  );
}
