# External data

All calls: 5 s timeout (AbortSignal.timeout), in-memory cache, stale fallback marked
"offline" when the upstream fails. Never trust responses: sanitize (strip control chars,
HTML/markup, collapse whitespace) and cap sizes (raw text <= 20,000 chars) before parsing.

## Wikipedia (Wikimedia)
- Search: `https://en.wikipedia.org/w/rest.php/v1/search/title?q=Q&limit=5`
- Summary: `https://en.wikipedia.org/api/rest_v1/page/summary/TITLE`
- Article text: `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&formatversion=2&titles=TITLE`
- Header: `User-Agent: Revenant/0.1 (REVENANT_CONTACT; Kiroween hackathon)` (required by Wikimedia policy).
- Attribution: "Text from Wikipedia, CC BY-SA 4.0." Show article title as source.
- Cache: 1 h.

## Open-Meteo
- `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Africa%2FKampala&forecast_days=3`
- Cities: Kampala 0.3476,32.5825; Gulu 2.7724,32.2881; Mbarara -0.6072,30.6545; Jinja 0.4244,33.2042.
- Attribution: "Weather data by Open-Meteo.com, CC BY 4.0." Cache: 15 min.

## Exchange rates
- `https://open.er-api.com/v6/latest/USD` (free, no key). UGX per X = rates.UGX / rates.X.
- Show "as of" from `time_last_update_utc`. Attribution: "Rates By Exchange Rate API".
- Cache: 1 h.

## Failure behavior
Timeout or error with cache -> serve stale deck flagged `offline: true`.
Timeout or error without cache -> error deck ("Can't reach X. Back to retry.").
