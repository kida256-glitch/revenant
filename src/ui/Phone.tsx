"use client";

import { mapKeyboard } from "@/core/keyboard";
import { verifyEd25519 } from "@/core/verify";
import { useCallback, useEffect, useRef, useState } from "react";
import { unavailableDeck } from "@/core/budget";
import { wrap } from "@/core/fit";
import { currentCard, currentPath, initialNav, navLoaded, navReduce, navType, type NavState } from "@/core/nav";
import { keypadText, type Key } from "@/core/t9";
import { DEFAULT_PROFILE, isProfileId, PROFILES, type Card, type Deck, type ProfileId } from "@/core/types";

type Status = "loading" | "ok" | "offline" | "error";
type Sig = "signed" | "invalid" | "unchecked" | "unsigned" | "checking" | null;

/** Server public key, fetched once per page load (long-cached by /api/public-key). */
let keyPromise: Promise<{ keyId: string; publicKey: string } | null> | null = null;
function serverKey() {
  keyPromise ??= fetch("/api/public-key")
    .then((r) => (r.ok ? (r.json() as Promise<{ keyId?: unknown; publicKey?: unknown }>) : null))
    .then((j) => (j && typeof j.keyId === "string" && typeof j.publicKey === "string" ? { keyId: j.keyId, publicKey: j.publicKey } : null))
    .catch(() => null);
  return keyPromise;
}

const KEYPAD: { key: Key; sub: string }[] = [
  { key: "1", sub: ".,?" }, { key: "2", sub: "abc" }, { key: "3", sub: "def" },
  { key: "4", sub: "ghi" }, { key: "5", sub: "jkl" }, { key: "6", sub: "mno" },
  { key: "7", sub: "pqrs" }, { key: "8", sub: "tuv" }, { key: "9", sub: "wxyz" },
  { key: "*", sub: "next" }, { key: "0", sub: "space" }, { key: "#", sub: "T9/abc" },
];


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
  const [weight, setWeight] = useState<"measuring" | number | null>(null);
  const weights = useRef(new Map<string, number>());
  const [signed, setSigned] = useState<Sig>(null);
  const [session, setSession] = useState(0);
  const navRef = useRef(nav);
  const cache = useRef(new Map<string, { deck: Deck; bytes: number; sig: Sig }>());

  const commit = useCallback((s: NavState) => {
    navRef.current = s;
    setNav(s);
  }, []);

  /** Non-blocking size comparison for article pages; failures show nothing. */
  const measure = useCallback((path: string) => {
    let title = "";
    try {
      title = decodeURIComponent(/^\/wiki\/a\/([^/?]+)/.exec(path)?.[1] ?? "");
    } catch {
      title = "";
    }
    if (!title) return setWeight(null);
    const known = weights.current.get(title);
    if (known !== undefined) return setWeight(known);
    setWeight("measuring");
    const still = () => currentPath(navRef.current) === path;
    fetch(`/api/weight?title=${encodeURIComponent(title)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: unknown) => {
        const n = (b as { normalBytes?: unknown } | null)?.normalBytes;
        if (typeof n !== "number" || !(n > 0)) throw new Error("no size");
        weights.current.set(title, n);
        if (still()) setWeight(n);
      })
      .catch(() => {
        if (still()) setWeight(null);
      });
  }, []);

  const load = useCallback(async (path: string, pid: ProfileId) => {
    const key = `${pid}|${path}`;
    const apply = (deck: Deck, n: number, fromCache: boolean, st: Status, sig: Sig) => {
      if (currentPath(navRef.current) !== path) return;
      commit(navLoaded(navRef.current, deck));
      setBytes(n);
      setCached(fromCache);
      setSigned(sig);
      if (st === "error") setWeight(null);
      else measure(path);
      setStatus(st);
    };
    const hit = cache.current.get(key);
    if (hit) return apply(hit.deck, hit.bytes, true, hit.deck.offline ? "offline" : hit.deck.error ? "error" : "ok", hit.sig);
    setStatus("loading");
    try {
      const res = await fetch(`/api/deck?path=${encodeURIComponent(path)}&profile=${pid}`);
      const raw = new Uint8Array(await res.arrayBuffer());
      const text = new TextDecoder().decode(raw);
      const n = raw.length;
      const body = JSON.parse(text) as { deck?: Deck };
      const deck = body.deck;
      if (!deck || !Array.isArray(deck.cards) || deck.cards.length === 0) throw new Error("bad deck");
      setSession((x) => x + n);
      const sigHeader = res.headers.get("X-Revenant-Signature");
      const sig: Sig = sigHeader && sigHeader !== "unsigned" ? "checking" : "unsigned";
      const entry: { deck: Deck; bytes: number; sig: Sig } = { deck, bytes: n, sig };
      if (res.ok && !deck.offline) cache.current.set(key, entry);
      apply(deck, n, false, deck.offline ? "offline" : deck.error ? "error" : "ok", sig);
      if (sig === "checking" && sigHeader) {
        // Non-blocking: verify the exact response bytes in the browser with Web Crypto Ed25519.
        const done = (v: Sig) => {
          entry.sig = v;
          if (currentPath(navRef.current) === path) setSigned(v);
        };
        const kid = res.headers.get("X-Revenant-Key-Id");
        serverKey()
          .then(async (k) => {
            if (!k) return done("unchecked");
            if (kid && kid !== k.keyId) return done("invalid");
            const r = await verifyEd25519(k.publicKey, sigHeader, raw);
            done(r === "valid" ? "signed" : r === "invalid" ? "invalid" : "unchecked");
          })
          .catch(() => done("unchecked"));
      }
    } catch {
      apply(unavailableDeck(path, "Network", PROFILES[pid]), 0, false, "error", null);
    }
  }, [commit, measure]);

  useEffect(() => {
    const saved = localStorage.getItem("revenant.profile");
    const pid = isProfileId(saved) ? saved : DEFAULT_PROFILE;
    setProfile(pid);
    const init = initialNav(pid);
    commit(init.state);
    void load("/", pid);
  }, [commit, load]);

  const press = useCallback((key: Key | { ch: string }) => {
    const res = typeof key === "string" ? navReduce(navRef.current, key) : navType(navRef.current, key.ch);
    commit(res.state);
    const eff = res.effect;
    if (eff?.type === "open" && eff.url.startsWith("https://")) window.open(eff.url, "_blank", "noopener,noreferrer");
    if (eff?.type === "load") void load(eff.path, res.state.profile);
    if (eff?.type === "profile") {
      localStorage.setItem("revenant.profile", eff.id);
      setProfile(eff.id);
      void load(currentPath(res.state), eff.id);
    }
  }, [commit, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const editable = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      const a = mapKeyboard({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, editable }, !!currentCard(navRef.current)?.input);
      if (!a) return;
      e.preventDefault();
      // Keyboard focus may sit on a clicked phone button; drop it so Enter isn't also a click.
      if (t instanceof HTMLButtonElement) t.blur();
      press(a.type === "key" ? a.key : { ch: a.ch });
    };
    // Capture phase on document: works without clicking the phone first.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
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
          {status !== "loading" && signed === "signed" && <span className="badge badge-ok" title="Ed25519 signature verified">&#10004; signed</span>}
          {status !== "loading" && signed === "unsigned" && <span className="badge badge-muted">unsigned</span>}
          {status !== "loading" && signed === "invalid" && <span className="badge badge-bad">&#10006; signature invalid</span>}
          {status !== "loading" && signed === "unchecked" && <span className="badge badge-muted">signed (not checked)</span>}
        </div>
        {weight !== null && bytes !== null && status !== "loading" && (
          <div className="meter-sub">
            {weight === "measuring"
              ? "Normal page HTML: measuring..."
              : `Normal page HTML: ${(weight / 1024).toFixed(1)} KB. This deck: ${(bytes / 1024).toFixed(1)} KB (article HTML only, no images or scripts)`}
          </div>
        )}
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
