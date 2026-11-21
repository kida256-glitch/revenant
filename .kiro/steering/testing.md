# Testing and Definition of Done

## Definition of Done (every milestone)
`npm run typecheck && npm run lint && npm test && npm run build`
Run it, show results. No failures, no skipped or `.only` tests.

## Property tests (fast-check), exactly these
1. Pagination: any text paginates into cards that fit the profile and byte budget;
   rejoining preserves every word in order.
2. T9/multitap round trip for supported text; keypad state machine never throws for
   any key sequence.
3. Navigation: any key sequence from any state keeps a valid state; Back returns to a
   previous valid page.
4. Parsers: arbitrary or hostile JSON (wrong types, huge, markup, control chars)
   always yields a valid deck within budget and never throws.

## Other tests
A few example-based unit tests where they clarify behavior. No Playwright, no mutation
testing. Network is never hit in tests: adapters are tested through pure parse functions.

## Hooks
- Agent save under `src/core/**` -> `npm run test:core`.
- Agent save of `.ts/.tsx` -> `npm run typecheck`.

Test files live next to code as `*.test.ts`.
