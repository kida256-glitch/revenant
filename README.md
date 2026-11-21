# Revenant

Revenant brings back WAP, the 1999 Wireless Application Protocol that served tiny text "decks of cards" to feature phones. A server-side transcoder turns today's web content (Wikipedia, weather, exchange rates) into small, cheap-to-load cards. It serves them three ways: a browser feature-phone simulator, a no-JavaScript HTML version for real feature-phone browsers, and real WML 1.1 for WAP browsers.

Built for Kiroween 2026 (Resurrection category).

## Who it's for

Feature-phone users in Uganda and East Africa who pay for data by the MB. Every screen in the simulator shows how many bytes the last deck cost.

## Features

1. **Wikipedia:** search with T9 or multitap typing, then read an article page by page. Article pages also show the size of the normal Wikipedia article HTML next to the deck size.
2. **Weather:** Open-Meteo current conditions and a 3-day forecast for Kampala, Gulu, Mbarara and Jinja.
3. **Money:** UGX per USD, EUR, GBP and KES, with an "as of" time.
4. **Ask:** type a question and get a 3-card answer from the top Wikipedia article summary, labeled with its source.
5. **Settings:** device profile, either Nokia 3310 (14x6 characters) or Generic (20x10).
6. **About:** attribution cards.

## Three ways to load Revenant

| URL | For | Format |
|-----|-----|--------|
| `/` | Any modern browser | Feature-phone simulator (React) over `GET /api/deck` (JSON) |
| `/lite` | Real feature-phone browsers (Opera Mini, KaiOS, old WebKit) | Server-rendered HTML with no JavaScript, images or CSS, usually under 3 KB. Keys 1-9 jump to numbered links and 0 goes Home. |
| `/wml` | Genuine WAP browsers | WML 1.1 (`text/vnd.wap.wml`): one `<card>` per screen, with links as `<a>` and searches as `<go method="get">` |

All three use the same router, adapters, core logic and byte budgets. For example, `/lite/wiki/a/Kampala` and `/wml/wiki/a/Kampala` serve the same deck as the simulator. Add `?pf=generic` to `/lite` or `/wml` URLs to use the 20x10 profile, or choose it on the Settings page.

## Architecture

```mermaid
flowchart LR
  subgraph Clients
    Sim["Simulator<br/>src/ui/Phone.tsx"]
    Lite["Feature-phone browser"]
    WAP["WAP browser"]
  end
  subgraph Server["Next.js 15 server"]
    API["GET /api/deck<br/>JSON {deck, bytes}"]
    Weight["GET /api/weight?title=<br/>{normalBytes}"]
    LiteR["GET /lite/...<br/>core/lite.ts -> HTML"]
    WmlR["GET /wml/...<br/>core/wml.ts -> WML 1.1"]
    Router["adapters/router.ts<br/>path -> deck"]
    HTTP["adapters/http.ts<br/>5 s timeout, cache, stale fallback"]
    Parse["adapters/parse.ts"]
    Core["src/core<br/>sanitize, paginate, byte budget,<br/>T9, nav, serializers"]
  end
  Up[(Wikipedia / Open-Meteo / open.er-api.com)]
  Sim --> API
  Sim -. "after the deck shows" .-> Weight --> HTTP
  Lite --> LiteR
  WAP --> WmlR
  API & LiteR & WmlR --> Router
  Router --> HTTP --> Up
  Router --> Parse --> Core
  Sim -. "nav + keypad reducers" .-> Core
```

`src/core` is pure logic with no fetch, React or Next imports, and ESLint enforces that. The WML and HTML serializers live in core and are property-tested.

## Run locally

Requires Node 24.x.

```sh
npm install
cp .env.example .env.local   # set REVENANT_CONTACT (sent in the Wikimedia User-Agent)
npm run dev                  # http://localhost:3000, /lite, /wml
```

Checks: `npm run typecheck && npm run lint && npm test && npm run build`.

Simulator keyboard: arrow keys for the 5-way pad, Enter = Select, Backspace/Escape = Back, and 0-9, `*`, `#` for the keypad. `#` toggles between T9 and multitap.

## Hosted

`<hosted URL here>`

## Attribution

- Text from Wikipedia, CC BY-SA 4.0. Each article card shows its source title.
- Weather data by [Open-Meteo.com](https://open-meteo.com/), CC BY 4.0.
- Rates by [Exchange Rate API](https://www.exchangerate-api.com) (open.er-api.com).

## Limitations

- The byte counter shows the real uncompressed UTF-8 size of the response body. Bytes on the wire differ because of gzip/brotli, HTTP headers and TLS. Back-navigation served from the simulator's cache shows 0 B.
- `/wml` is standard WML 1.1 output, checked as well-formed XML by property tests. It has not been tested on physical WAP devices or through a WAP gateway. `/lite` has not been tested on physical phones either.
- The size comparison counts only the normal article's HTML document, with no images, scripts or CSS, so a real page load weighs more. The simulator requests it from `/api/weight` after the article deck is shown, so it never delays the deck. It shows "measuring..." until the size arrives (often a second or more, since Wikipedia's HTML runs to hundreds of KB) and shows nothing if the request fails. `/lite` and `/wml` do not show the comparison.
- Only English Wikipedia. Article titles are capped at 60 characters (with a visible "~"), and typed input at 40.
- Caches live in server memory. On serverless hosting they reset on cold starts, so the "offline" stale fallback works only while an instance stays warm.
- Free upstream APIs have rate limits. When an upstream fails and nothing is cached, you get an error deck.
- There are no browser end-to-end tests, only unit and property tests.

## Originality

All application code in this repo was written for this project with Kiro. Third-party pieces:

- Frameworks: [Next.js 15](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/) (simulator only).
- Language and tooling: TypeScript 5, ESLint 9 with `eslint-config-next`.
- Testing: [Vitest](https://vitest.dev/), [fast-check](https://fast-check.dev/) (property tests), [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) (test-only, validates WML output).
- Data: Wikipedia REST/Action APIs and article pages, Open-Meteo, open.er-api.com. No API keys, database or accounts.
- WML 1.1 follows the WAP Forum DTD (`-//WAPFORUM//DTD WML 1.1//EN`).

## License

MIT
