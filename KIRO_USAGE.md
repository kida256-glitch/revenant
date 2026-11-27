# Kiro usage log

- M0: Steering (5 docs), one spec (EARS requirements/design/tasks), two PostFileSave hooks (format checked against kiro.dev/docs/hooks). Worked: single-pass spec. Ambiguity decisions: one screen = one card; settings links use `set:profile=` handled client-side; rates from open.er-api.com.
- M1: Spec tasks drove order; PostFileSave hooks ran core tests/typecheck on save. Property test 4 caught a real bug (long titles overflowed the 200-char path cap); fixed with TITLE_MAX=60. Vitest ran without approving esbuild's install script. Decision: response 'bytes' is a self-consistent UTF-8 length of the uncompressed body; data fetches use in-memory cache + next.revalidate=300.
- M2: Simulator built as one client component over the pure nav/keypad reducers from core, so no new logic needed tests. Typecheck hook caught nothing new. Decisions: back-navigation reuses a client-side deck cache (shows 'cached, 0 B used'); network failure renders a local 'service unavailable' deck; counter measures the received body with TextEncoder. Not verified in a real browser (no Playwright by request).
- M3: README (mermaid architecture, attribution, limitations, Originality) and final Definition of Done. Docs only, no new code.

## Property-test bug story
Property test 4 (hostile JSON -> valid in-budget deck) generated very long Wikipedia titles. The parser built `wiki:article/TITLE` link paths that went over the API's 200-char path limit, so following the link would have been rejected by route validation. Fix: cap titles at TITLE_MAX=60 with a visible "~" marker. Example tests had only used short titles and missed this.

## What didn't work or surprised us
- Hooks load at session start. Edits to `.kiro/hooks` took effect only in a new session, and the hooks fire on agent saves, not on manual edits.
- npm blocked esbuild's install script, but Vitest still ran fine without approving it.

## M4 Old protocols
- 4.1 /wml: pure WML 1.1 serializer in core; fast-check feeds hostile decks and parses output with fast-xml-parser. Passed first run; `$` must be doubled (WML variable syntax) and lone surrogates stripped for XML.
- 4.2 /lite: no-JS HTML with accesskeys 1-9, Home=0; property checks a tag/attribute allowlist, unique accesskeys, escaped `&`, and < 3 KB for real paginated decks.
- 4.3 normalBytes: article HTML fetched in parallel and used only if settled before the deck (fail open). Surprise: the 735 KB Wikipedia HTML is slower than the API, so the first view usually lacks the comparison; it appears from the cache on later loads.
- 4.4 README rewritten (three ways to load, honest limitations). 4.5 Definition of Done: 19/19 tests, typecheck, lint, build green.
- Surprise: `npm run dev` must run via a background process tool, not a plain shell call; and build had to wait until the dev server was stopped to avoid sharing `.next`.

## M5 Agents, signatures, anchor
- 5.1 MCP: read-only stdio server (`render_deck`, `measure_deck`) via @modelcontextprotocol/sdk 1.32 `registerTool`, tested in-process with InMemoryTransport (exact tool list; hostile paths give `isError` results). Kiro blocked writing `.kiro/settings/mcp.json`, so the config is in the README for the user to add.
- 5.2 Signing: Ed25519 over exact body bytes with `node:crypto`, headers on /api/deck, /lite and /wml, `/api/verify`, badge. Properties: any single-byte change fails verification (300 runs); hostile verifier input always returns JSON. Checked live against a production build with a throwaway key: all three routes valid, tampered bodies rejected.
- 5.3 Anchor: viem 2.58 `baseSepolia` (RPC sepolia.base.org, explorer sepolia.basescan.org), Merkle root with a test vector computed independently with .NET SHA256, `/about/proof` deck, external links open via a new nav `open` effect. `--dry-run` against localhost verified all three pages; the real transaction is left to the user.
- 5.4 README (Signed cards, diagram, Originality), Definition of Done.
- Surprises: in PowerShell `H` is an alias for Get-History, which broke an inline SHA helper. Parallel tool calls ran out of order once (a build raced `next start`, and an append raced a file write). Multi-line PowerShell commands sometimes returned no output and had to be rerun. The full test run caught a real M4.1 bug (raw `]` in /wml links).
- MCP from Kiro: `render_deck` and `measure_deck` on `/wiki/a/Kampala` (nokia3310) returned 11 cards, 1,293 deck bytes (1,315 response), all within budget; it also showed empty `(UK: , US: )` where pronunciations were stripped.
- Post-M5: the MCP server (`render_deck` on a Wikipedia article) revealed a sanitizer bug: pronunciation markup left empty or label-only brackets like `(UK: , US: )`. Fixed with a property test (no junk groups remain, every real word kept in order). The signed badge now verifies in the browser with Web Crypto Ed25519 instead of uploading the body to /api/verify.
- Anchor done: Base Sepolia tx 0xc3c10b70dbe10392a7b824ae300ae395e832241f93e6248b59cd411fe9bda40b (root dafff9a2...38e8f), committed in anchors/latest.json. Follow-up fixes: laptop keyboard typing (document-level capture listener, letters type straight into inputs) and badge colors (green signed, red invalid, grey otherwise).
- M6 AI gateway: Gemini docs had moved to the Interactions API (POST /v1beta/interactions, x-goog-api-key, Api-Revision 2026-05-20, model_output steps), which differs from the older generateContent API I would have guessed. Model gemini-3.5-flash-lite. Grounded Ask (top 1-2 summaries) and Brief (AI) with fallback, per-IP limit and secret-leak filter. The first property run caught the non-AI Ask fallback exceeding 3 cards, which is expected: only AI answers are capped.
