# Device constraints

## Profiles (characters)
| id        | name         | cols | rows |
|-----------|--------------|------|------|
| nokia3310 | Nokia 3310   | 14   | 6    |
| generic   | Generic      | 20   | 10   |

Row 1 of each screen is the card title. Rows 2..rows hold body lines and links.
Softkey labels render below the LCD and do not use text rows.

## Byte budgets (UTF-8 length of `JSON.stringify`)
- Card <= 1,000 bytes. Deck <= 1,400 bytes.
- Never truncate silently. Long content paginates into more cards; if a deck would
  exceed budget, split into another deck reached by a "More" link.
- Any visible shortening must carry a visible marker (e.g. "~").

## Keys
- Digits 0-9, `*`, `#`: T9 / multitap input when a card has an input field.
- 5-way: Up, Down, Left (prev card), Right (next card), Select (follow focused link / submit).
- Softkeys: Left = Select/OK, Right = Back (on empty input: Back; else delete char).
- `#` toggles T9 / multitap. `0` = space. `1` = punctuation (`.,?!'-1`).
- Keyboard: arrows, Enter = Select, Backspace/Escape = Back, 0-9 * #.

## Text
Plain ASCII-safe printable text after sanitize. Width measured in code points.
