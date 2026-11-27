# Tech

- TypeScript strict (+ noUncheckedIndexedAccess), Node 24.x, Next.js 15 App Router, Tailwind v4.
- Tests: Vitest + fast-check. No database, accounts, or secrets.

## Layers
- `src/core/`: pure logic. No fetch, no Next/React, no imports from other layers
  (enforced by ESLint `no-restricted-imports` / `no-restricted-globals`).
  Card/deck model, text fitting + pagination, byte budgeting, T9/multitap, navigation state machine.
- `src/adapters/`: pure `parseX(json) -> Deck` functions plus thin fetch wrappers
  (5 s timeout, cache, stale fallback). May import core.
- `src/app/api/deck/route.ts`: the deck API: `GET /api/deck?path=...&profile=...`
  returns `{ deck, bytes }`. Also `/api/weight` (article HTML size) and `/api/verify` (signature check).
- `src/mcp/` + `scripts/`: read-only MCP server and local scripts (tsx). Never in the Next bundle.
- `src/app/wml/` and `src/app/lite/`: render the same resolved decks via pure core serializers (`core/wml.ts`, `core/lite.ts`).
- `src/ui/` + `src/app/page.tsx`: simulator. Talks only to `/api/deck`.

## Conventions
- Named exports, small pure functions, no classes unless state demands it.
- Import alias `@/` maps to `src/`.
- Untrusted text goes through `sanitize()` in core before it reaches a card.
- LF line endings (.gitattributes). Commit messages name the milestone.
- Scripts: `typecheck`, `lint`, `test`, `test:core`, `build`.
