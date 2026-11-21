import { finalize, MAX_PATH, menuCards, notFoundDeck, pageDeck, unavailableDeck } from "@/core/budget";
import { paginate } from "@/core/fit";
import { sanitize } from "@/core/sanitize";
import type { Deck, Profile } from "@/core/types";
import { PROFILES } from "@/core/types";
import { getJson as defaultGet, type GetJson } from "./http";
import { parseAsk, parseRates, parseWeather, parseWikiArticle, parseWikiSearch, TITLE_MAX, topTitle } from "./parse";

export const CITIES: Record<string, { name: string; lat: number; lon: number }> = {
  kampala: { name: "Kampala", lat: 0.3476, lon: 32.5825 },
  gulu: { name: "Gulu", lat: 2.7724, lon: 32.2881 },
  mbarara: { name: "Mbarara", lat: -0.6072, lon: 30.6545 },
  jinja: { name: "Jinja", lat: 0.4244, lon: 33.2042 },
};

const ABOUT: Record<string, { title: string; text: string }> = {
  wikipedia: { title: "Wikipedia", text: "Articles and summaries from Wikipedia, the free encyclopedia. Text is CC BY-SA 4.0. wikipedia.org" },
  "open-meteo": { title: "Open-Meteo", text: "Weather data by Open-Meteo.com, CC BY 4.0. open-meteo.com" },
  rates: { title: "Rates", text: "Rates By Exchange Rate API. exchangerate-api.com" },
  revenant: { title: "Revenant", text: "WAP, resurrected. Today's web as tiny cards for phones that pay per MB. MIT licensed." },
};

const WIKI = "https://en.wikipedia.org";
const HOUR = 3_600_000;

export interface Resolved {
  deck: Deck;
  status: number;
}

function staticDeck(path: string, title: string, intro: string, links: { label: string; href: string }[], profile: Profile, input?: { name: string; action: string }): Deck {
  return pageDeck(menuCards(title, intro, links, profile, { input }), 0, () => path, profile);
}

async function route(path: string, profile: Profile, get: GetJson): Promise<Resolved> {
  const url = new URL(`http://x${path}`);
  const parts = url.pathname.split("/").filter(Boolean);
  const q = sanitize(url.searchParams.get("q") ?? "", 40);
  const notFound = (): Resolved => ({ deck: notFoundDeck(path, profile), status: 404 });
  const [a, b, c] = parts;

  if (parts.length === 0) {
    return {
      status: 200,
      deck: staticDeck("/", "Revenant", "", [
        { label: "1 Wikipedia", href: "/wiki" },
        { label: "2 Weather", href: "/weather" },
        { label: "3 Money", href: "/money" },
        { label: "4 Ask", href: "/ask" },
        { label: "5 Settings", href: "/settings" },
        { label: "6 About", href: "/about" },
      ], profile),
    };
  }

  if (a === "wiki" && !b) {
    return { status: 200, deck: staticDeck(path, "Wikipedia", "Type a topic, then OK.", [], profile, { name: "q", action: "/wiki/search" }) };
  }
  if (a === "wiki" && b === "search" && !c) {
    if (!q) return notFound();
    const u = `${WIKI}/w/rest.php/v1/search/title?${new URLSearchParams({ q, limit: "5" })}`;
    const r = await get(u, HOUR);
    return { status: 200, deck: { ...parseWikiSearch(r.json, q, path, profile), ...(r.stale && { offline: true }) } };
  }
  if (a === "wiki" && b === "a" && c && parts.length === 3) {
    const title = sanitize(decodeURIComponent(c), TITLE_MAX);
    if (!title) return notFound();
    const p = Math.min(1000, Math.max(0, Number.parseInt(url.searchParams.get("p") ?? "0", 10) || 0));
    const u = `${WIKI}/w/api.php?${new URLSearchParams({ action: "query", prop: "extracts", explaintext: "1", format: "json", formatversion: "2", redirects: "1", titles: title })}`;
    const r = await get(u, HOUR);
    const deck = { ...parseWikiArticle(r.json, title, p, profile), ...(r.stale && { offline: true }) };
    return { status: 200, deck };
  }

  if (a === "weather" && !b) {
    return {
      status: 200,
      deck: staticDeck(path, "Weather", "", Object.entries(CITIES).map(([id, city], i) => ({ label: `${i + 1} ${city.name}`, href: `/weather/${id}` })), profile),
    };
  }
  if (a === "weather" && b && !c) {
    const city = CITIES[b];
    if (!city) return notFound();
    const params = new URLSearchParams({
      latitude: String(city.lat), longitude: String(city.lon),
      current: "temperature_2m,weather_code,wind_speed_10m",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone: "Africa/Kampala", forecast_days: "3",
    });
    const r = await get(`https://api.open-meteo.com/v1/forecast?${params}`, 15 * 60_000);
    return { status: 200, deck: { ...parseWeather(r.json, city.name, path, profile), ...(r.stale && { offline: true }) } };
  }

  if (a === "money" && !b) {
    const r = await get("https://open.er-api.com/v6/latest/USD", HOUR);
    return { status: 200, deck: { ...parseRates(r.json, path, profile), ...(r.stale && { offline: true }) } };
  }

  if (a === "ask" && !b) {
    return { status: 200, deck: staticDeck(path, "Ask", "Type a question, then OK.", [], profile, { name: "q", action: "/ask/q" }) };
  }
  if (a === "ask" && b === "q" && !c) {
    if (!q) return notFound();
    const s = await get(`${WIKI}/w/rest.php/v1/search/title?${new URLSearchParams({ q, limit: "1" })}`, HOUR);
    const title = topTitle(s.json);
    const sum = title ? await get(`${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(title)}`, HOUR) : { json: null, stale: s.stale };
    return { status: 200, deck: { ...parseAsk(sum.json, q, path, profile), ...((s.stale || sum.stale) && { offline: true }) } };
  }

  if (a === "settings" && !b) {
    return {
      status: 200,
      deck: staticDeck(path, "Settings", `Now: ${profile.name}`, Object.values(PROFILES).map((pr) => ({
        label: `${pr.name} ${pr.cols}x${pr.rows}`, href: `set:profile=${pr.id}`,
      })), profile),
    };
  }

  if (a === "about" && !b) {
    return {
      status: 200,
      deck: staticDeck(path, "About", "", Object.entries(ABOUT).map(([id, x], i) => ({ label: `${i + 1} ${x.title}`, href: `/about/${id}` })), profile),
    };
  }
  if (a === "about" && b && !c) {
    const item = ABOUT[b];
    if (!item) return notFound();
    return { status: 200, deck: pageDeck(paginate(item.title, item.text, profile, "b"), 0, () => path, profile) };
  }

  return notFound();
}

const SOURCES: Record<string, string> = { wiki: "Wikipedia", ask: "Wikipedia", weather: "Weather", money: "Rates" };

/** Resolve a path to a deck. Never throws; always returns a valid in-budget deck. */
export async function resolveDeck(rawPath: unknown, profile: Profile, get: GetJson = defaultGet): Promise<Resolved> {
  if (typeof rawPath !== "string" || !rawPath.startsWith("/") || rawPath.length > MAX_PATH) {
    return { deck: notFoundDeck("/", profile), status: 404 };
  }
  try {
    const r = await route(rawPath, profile, get);
    return { ...r, deck: finalize(r.deck, profile) };
  } catch (err) {
    if (err instanceof URIError) return { deck: notFoundDeck(rawPath, profile), status: 404 };
    const top = rawPath.split(/[/?]/)[1] ?? "";
    return { deck: finalize(unavailableDeck(rawPath, SOURCES[top] ?? "Service", profile), profile), status: 503 };
  }
}
