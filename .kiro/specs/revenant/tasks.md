# Tasks: Revenant MVP

## M0 Scaffold
- [x] 0.1 package.json, tsconfig, ESLint (core import rule), Vitest, Tailwind, Next skeleton
- [x] 0.2 Steering docs, hooks, spec, KIRO_USAGE.md

## M1 Core, adapters, API
- [x] 1.1 core/types, sanitize, fit (wrap/paginate), budget (bytes/buildDecks), menu (R1, R6.4)
- [x] 1.2 Property test 1: pagination fits profile + budget, words preserved (R1)
- [x] 1.3 core/t9: T9 + multitap encode/decode, keypad reducer (R2)
- [x] 1.4 Property test 2: round trip + keypad never throws (R2.3)
- [x] 1.5 core/nav reducer with effects (R3)
- [x] 1.6 Property test 3: any key sequence keeps valid state; Back returns to prior page (R3.4)
- [x] 1.7 adapters/parse: wiki search/article/summary, weather, rates (R4, R6.5)
- [x] 1.8 Property test 4: hostile JSON -> valid in-budget deck, never throws (R6.5)
- [x] 1.9 adapters/http: timeout, UA, cache, stale/offline fallback (R6.1-3, R6.6)
- [x] 1.10 adapters/router + static decks (home, settings, about) (R4.1, R4.6-7)
- [x] 1.11 app/api/deck route with validation (R7)
- [x] 1.12 Definition of Done; commit + push

## M2 Simulator UI
- [x] 2.1 Phone shell, LCD, softkeys, 5-way, keypad, keyboard support (R2, R3)
- [x] 2.2 Byte counter, loading/offline/error states, profile persistence (R5, R4.6)
- [x] 2.3 Phone-sized responsive layout, ghost styling
- [x] 2.4 Definition of Done; commit + push; Vercel checklist

## M3 Docs
- [x] 3.1 README (what/who, mermaid, run locally, hosted URL placeholder, attribution, limitations, Originality)
- [x] 3.2 Final Definition of Done; commit + push; report

## M4 Old protocols
- [x] 4.1 core/wml serializer + /wml route + property (well-formed, no control chars, /wml targets)
- [x] 4.2 core/lite HTML + /lite route + property (no script/img/handlers, unique accesskeys, escaped)
- [x] 4.3 normalBytes on article pages (parallel, fail open) + simulator line
- [x] 4.4 README rewrite
- [x] 4.5 Definition of Done; KIRO_USAGE; commit + push
