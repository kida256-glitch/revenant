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
