# Requirements: Revenant MVP

EARS notation. "System" = Revenant (API + simulator).

## R1 Deck model and budgets
1. The system SHALL represent content as decks of cards; each card has a title, body lines, links and an optional input.
2. The system SHALL keep every card <= 1,000 bytes and every deck <= 1,400 bytes (UTF-8 JSON).
3. WHEN content exceeds a card's rows, THE system SHALL paginate it into further cards, never dropping words.
4. WHEN a deck would exceed its budget, THE system SHALL split it and link the next deck with "More".
5. The system SHALL fit every line to the active profile width (Nokia 3310 14x6, generic 20x10).

## R2 Input
1. WHILE a card with an input is shown, WHEN a digit key is pressed, THE system SHALL enter text using T9 (default) or multitap.
2. WHEN `#` is pressed, THE system SHALL toggle T9/multitap.
3. The keypad state machine SHALL never throw for any key sequence.

## R3 Navigation
1. WHEN Up/Down is pressed, THE system SHALL move focus between links.
2. WHEN Left/Right is pressed, THE system SHALL show the previous/next card.
3. WHEN Select is pressed on a link, THE system SHALL load the linked deck.
4. WHEN Back is pressed, THE system SHALL return to the previous page; at Home it SHALL stay at Home.

## R4 Content
1. Home SHALL list 1 Wikipedia, 2 Weather, 3 Money, 4 Ask, 5 Settings, and About.
2. WHEN a Wikipedia query is submitted, THE system SHALL list up to 5 matching titles; WHEN one is selected, THE system SHALL show the article as pages.
3. WHEN a city is selected, THE system SHALL show current weather and a 3-day forecast from Open-Meteo.
4. The Money page SHALL show UGX per USD, EUR, GBP, KES and an "as of" time.
5. WHEN a question is submitted in Ask, THE system SHALL answer in at most 3 cards from the top Wikipedia result's summary, labeled with the source title.
6. WHEN a profile is chosen in Settings, THE system SHALL use it for all later decks.
7. About SHALL contain attribution cards for Wikipedia, Open-Meteo and the rates provider.

## R5 Byte metric
1. WHEN any deck loads, THE simulator SHALL display its size in bytes.

## R6 Resilience and safety
1. The system SHALL time out upstream calls after 5 s.
2. IF an upstream call fails AND a cached deck exists, THEN THE system SHALL serve it marked "offline".
3. IF an upstream call fails AND no cache exists, THEN THE system SHALL return an error deck.
4. The system SHALL strip control characters and markup from external text and cap its size.
5. IF parser input is malformed or hostile, THEN THE parser SHALL still return a valid in-budget deck.
6. The system SHALL send a descriptive User-Agent to Wikimedia.

## R7 API
1. The system SHALL expose only `GET /api/deck?path=&profile=` returning `{ deck, bytes }`.
2. IF `path` is unknown or invalid, THEN THE API SHALL return a "Not found" deck with HTTP 404.
