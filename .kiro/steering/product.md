# Product: Revenant

Revenant resurrects WAP (1999 Wireless Application Protocol: tiny text "decks of cards"
for feature phones) with a modern engine. A server-side transcoder turns today's web
content into tiny, cheap-to-load cards. The client is a browser feature-phone simulator.

## Audience
Feature-phone users in Uganda / East Africa who pay per MB. Every byte costs money.

## Headline metric
Bytes per page. Every screen shows the byte size of the deck just loaded.

## MVP menu (nothing else)
1. Wikipedia: T9-typed search, read an article as pages.
2. Weather: Open-Meteo for Kampala, Gulu, Mbarara, Jinja.
3. Money: UGX per USD/EUR/GBP/KES, with "as of" time.
4. Ask: type a question, answer in 3 short cards from the top Wikipedia article summary, labeled with its source.
5. Settings: device profile (Nokia 3310 14x6, generic 20x10).
About: attribution cards (Wikipedia, Open-Meteo, exchange-rate provider).

## Out of scope
MCP server, Gemini/LLMs, blockchain, offline mode,
Playwright, other languages, accounts, databases.

## Tone
Dark shell with subtle ghost/Halloween styling. Plain, short copy on the LCD.
## M4 additions (in scope)
Real WML 1.1 at /wml, no-JS HTML at /lite, normal-article-HTML size comparison on Wikipedia article pages.
