import { menuCards, pageDeck, MAX_PATH } from "@/core/budget";
import { bodyRows, fitLine, paginate } from "@/core/fit";
import { sanitize } from "@/core/sanitize";
import type { Card, Deck, Link, Profile } from "@/core/types";

/** Keeps `/wiki/a/<encoded>?p=NNNN` within MAX_PATH. */
export const TITLE_MAX = 60;

type Obj = Record<string, unknown>;

function obj(x: unknown): Obj {
  return typeof x === "object" && x !== null && !Array.isArray(x) ? (x as Obj) : {};
}

function arr(x: unknown, max = 50): unknown[] {
  return Array.isArray(x) ? x.slice(0, max) : [];
}

function num(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

export function articleHref(title: string, p = 0): string {
  return `/wiki/a/${encodeURIComponent(title)}${p > 0 ? `?p=${p}` : ""}`;
}

function simpleDeck(path: string, title: string, text: string, profile: Profile, links: Link[] = []): Deck {
  return { path, cards: menuCards(title, text, links, profile).slice(0, 6) };
}

// Wikipedia -----------------------------------------------------------------

export function parseWikiSearch(json: unknown, query: string, path: string, profile: Profile): Deck {
  const q = sanitize(query, 40);
  const links: Link[] = [];
  for (const page of arr(obj(json).pages, 5)) {
    const title = sanitize(obj(page).title, TITLE_MAX);
    if (!title) continue;
    const href = articleHref(title);
    if (href.length <= MAX_PATH) links.push({ label: title, href });
  }
  if (links.length === 0) {
    return simpleDeck(path, "Wikipedia", `No results for "${q}".`, profile, [{ label: "Search again", href: "/wiki" }]);
  }
  return pageDeck(menuCards("Results", `"${q}":`, links, profile), 0, () => path, profile);
}

export function parseWikiArticle(json: unknown, rawTitle: string, p: number, profile: Profile): Deck {
  const title = sanitize(rawTitle, TITLE_MAX) || "X";
  const page = obj(arr(obj(obj(json).query).pages, 1)[0]);
  const t = sanitize(page.title, 80) || sanitize(title, 80) || "Article";
  const text = sanitize(page.extract);
  const pathFor = (n: number) => articleHref(title, n);
  if (!text) {
    return simpleDeck(pathFor(0), "Wikipedia", `No article text for "${t}".`, profile, [{ label: "Search", href: "/wiki" }]);
  }
  const brief = `/wiki/brief/${encodeURIComponent(title)}`;
  const lead = p === 0 && brief.length <= MAX_PATH ? menuCards(t, "", [{ label: "Brief (AI)", href: brief }], profile, { idPrefix: "b" }) : [];
  const cards = [...lead, ...paginate(t, text, profile, "a"), ...attributionCard(t, profile)];
  return pageDeck(cards.map((c, i) => ({ ...c, id: `a${i}` })), p, pathFor, profile);
}

function attributionCard(title: string, profile: Profile): Card[] {
  return paginate("Source", `Wikipedia: ${title}. CC BY-SA 4.0.`, profile, "s");
}

/** Titles of the top `n` search hits. */
export function topTitles(json: unknown, n: number): string[] {
  return arr(obj(json).pages, n).map((p) => sanitize(obj(p).title, TITLE_MAX)).filter(Boolean);
}
/** Plain summary text from a Wikipedia page/summary response ("" if none). */
export function summaryText(json: unknown, max = 2000): { title: string; text: string } {
  const o = obj(json);
  return { title: sanitize(o.title, 80), text: sanitize(o.extract, max) };
}
/** Characters to ask the model for so an answer fits 3 cards of this profile. */
export function aiChars(profile: Profile): number {
  return Math.max(60, Math.floor(3 * bodyRows(profile) * profile.cols * 0.55) - 40);
}
export const ANSWER_CARDS = 3;
/**
 * Answer deck of at most 3 cards: (notice) body, "Source: <titles>", then links.
 * The body is shortened word by word, with a visible "~", until it fits.
 */
export function answerDeck(
  path: string,
  kind: "ask" | "brief",
  body: string,
  sources: string[],
  profile: Profile,
  opts: { ai: boolean; notice?: string; links?: Link[] },
): Deck {
  const title = fitLine(opts.ai ? (kind === "ask" ? "AI answer" : "AI brief") : kind === "ask" ? "Answer" : "Brief", profile.cols);
  const lead = opts.ai ? "" : `${opts.notice ? sanitize(opts.notice, 60) + " " : ""}Offline answer. `;
  const src = sanitize(sources.map((s) => sanitize(s, 80)).filter(Boolean).join("; ") || "Wikipedia", 50);
  const tail = ` Source: ${src}.`;
  const words = sanitize(body).split(" ").filter(Boolean);
  const build = (n: number, links: Link[]) =>
    menuCards(title, `${lead}${words.slice(0, n).join(" ")}${n < words.length ? " ~" : ""}${tail}`.trim(), links, profile, { idPrefix: "q" });
  for (const links of [opts.links ?? [], []]) {
    let lo = 0;
    let hi = words.length;
    if (build(0, links).length > ANSWER_CARDS) continue;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (build(mid, links).length <= ANSWER_CARDS) lo = mid;
      else hi = mid - 1;
    }
    return pageDeck(build(lo, links), 0, () => path, profile);
  }
  return pageDeck(menuCards(title, `${lead}Source: Wikipedia.`, [], profile, { idPrefix: "q" }).slice(0, ANSWER_CARDS), 0, () => path, profile);
}
/** Title of the top search hit, or "" if none. */
export function topTitle(json: unknown): string {
  return sanitize(obj(arr(obj(json).pages, 1)[0]).title, TITLE_MAX);
}

export function parseAsk(json: unknown, question: string, path: string, profile: Profile, notice = ""): Deck {
  const o = obj(json);
  const title = sanitize(o.title, 80);
  const extract = sanitize(o.extract, 3000);
  const text = extract && notice ? `${sanitize(notice, 80)} ${extract}` : extract;
  if (!title || !text) {
    return simpleDeck(path, "Ask", `No answer found for "${sanitize(question, 40)}".`, profile, [{ label: "Ask again", href: "/ask" }]);
  }
  const all = paginate(title, text, profile, "q");
  const cut = all.length > 3;
  const answer = all.slice(0, 3);
  const href = articleHref(title);
  const source = menuCards(
    "Source",
    `${cut ? "Summary cut. " : ""}From Wikipedia: ${title}. CC BY-SA 4.0.`,
    href.length <= MAX_PATH ? [{ label: "Read article", href }] : [],
    profile,
    { idPrefix: "s" },
  );
  return pageDeck([...answer, ...source], 0, () => path, profile);
}

// Weather -------------------------------------------------------------------

const WMO: Record<number, string> = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Cloudy", 45: "Fog", 48: "Fog",
  51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  80: "Showers", 81: "Showers", 82: "Heavy showers", 95: "Thunderstorm", 96: "Storm+hail", 99: "Storm+hail",
};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayName(x: unknown): string {
  const s = typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : "";
  const d = s ? new Date(`${s}T12:00:00Z`) : null;
  return d && !Number.isNaN(d.getTime()) ? (DAYS[d.getUTCDay()] ?? "Day") : "Day";
}

const r0 = (n: number) => String(Math.round(n));

export function parseWeather(json: unknown, city: string, path: string, profile: Profile): Deck {
  const o = obj(json);
  const cur = obj(o.current);
  const daily = obj(o.daily);
  const parts: string[] = [];
  const t = num(cur.temperature_2m);
  const code = num(cur.weather_code);
  const wind = num(cur.wind_speed_10m);
  if (t !== null) parts.push(`Now ${r0(t)}C.`);
  if (code !== null) parts.push(`${WMO[code] ?? "Mixed"}.`);
  if (wind !== null) parts.push(`Wind ${r0(wind)} km/h.`);
  const dates = arr(daily.time, 3);
  const max = arr(daily.temperature_2m_max, 3);
  const min = arr(daily.temperature_2m_min, 3);
  const rain = arr(daily.precipitation_probability_max, 3);
  dates.forEach((d, i) => {
    const hi = num(max[i]);
    const lo = num(min[i]);
    const pr = num(rain[i]);
    if (hi === null || lo === null) return;
    parts.push(`${dayName(d)} ${r0(lo)}-${r0(hi)}C${pr !== null ? ` rain ${r0(pr)}%` : ""}.`);
  });
  const name = sanitize(city, 20) || "Weather";
  if (parts.length === 0) return simpleDeck(path, name, "No weather data.", profile);
  const text = parts.join(" ") + " Data: Open-Meteo.";
  return pageDeck(paginate(name, text, profile, "w"), 0, () => path, profile);
}

// Money ---------------------------------------------------------------------

function group(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function asOf(x: unknown): string {
  const d = typeof x === "string" ? new Date(sanitize(x, 60)) : null;
  if (!d || Number.isNaN(d.getTime())) return "unknown";
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function parseRates(json: unknown, path: string, profile: Profile): Deck {
  const o = obj(json);
  const rates = obj(o.rates);
  const ugx = num(rates.UGX);
  const parts: string[] = [];
  if (ugx !== null && ugx > 0) {
    for (const c of ["USD", "EUR", "GBP", "KES"]) {
      const r = c === "USD" ? 1 : num(rates[c]);
      if (r === null || r <= 0) continue;
      const v = ugx / r;
      if (!Number.isFinite(v) || v > 1e12) continue;
      parts.push(`1 ${c} = ${v < 100 ? v.toFixed(2) : group(v)} UGX.`);
    }
  }
  if (parts.length === 0) return simpleDeck(path, "Money", "No rates data.", profile);
  const text = `${parts.join(" ")} As of ${asOf(o.time_last_update_utc)}.`;
  return pageDeck(paginate("UGX rates", text, profile, "r"), 0, () => path, profile);
}
