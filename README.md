# Weather Comfort Atlas

A server-driven weather analytics dashboard built with Express, EJS and HTMX. It obtains current conditions from OpenWeatherMap, calculates a ranked Comfort Index on the backend, and replaces only the leaderboard when a user refreshes it.

## Setup

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Create an OpenWeatherMap API key and set `OPENWEATHER_API_KEY`.
4. Run `npm install`, then `npm run dev`.
5. Visit `http://localhost:3000`.

The supplied source file contained eight cities. This project extends it to ten with London and Singapore so it meets the assignment's minimum; the legacy `Temp` and `Status` fields are intentionally ignored because the live OpenWeatherMap response is authoritative.

## Comfort Index

The score is calculated only by `src/utils/comfort-index.js` and capped at 0–100:

`temperature fit × 45 + humidity fit × 25 + wind comfort × 15 + visibility quality × 15`

- **Temperature (45%)**: 22°C is the target, with a gradual penalty further from it. It gets the largest weight because it is the most immediate driver of outdoor comfort.
- **Humidity (25%)**: 50% is the target; uncomfortable dryness or mugginess reduces the score.
- **Wind (15%)**: wind above 2 m/s receives a progressive penalty, reflecting wind chill and disruption.
- **Visibility (15%)**: clear conditions improve practical outdoor comfort and safety.

This is deliberately transparent rather than a medical heat-index model. It is designed for comparability, and can be adjusted according to a user’s preferences in a future version.

## Cache design

Raw OpenWeatherMap responses are cached in memory for 300 seconds with `node-cache`. The cache is keyed by city ID, so one unavailable city does not invalidate the rest. `GET /api/cache-status` reports cache keys and the most recent `HIT` or `MISS` for each key.

The processed ranking is recalculated from cached raw data. This avoids stale derived data while keeping API calls low. For a multi-instance production deployment, Redis would replace the in-memory cache.

## Auth0 submission configuration

Set `AUTH_ENABLED=true`, create an Auth0 **Regular Web Application**, then configure callback URL `http://localhost:3000/callback` and logout URL `http://localhost:3000`. Add Auth0 credentials to `.env`.

In Auth0, disable public sign-ups, create the required `careers@fidenz.com` test user, and enable email MFA. Auth0 tenant configuration cannot safely be committed as code, so document the final tenant settings with screenshots or this checklist.

## Trade-offs and limitations

- HTMX keeps the client small and the server as the source of truth, but it is less appropriate than a SPA for complex client-side state.
- The free weather API is subject to rate limits and may have delayed activation after key creation.
- Visibility may be absent for some stations; the current implementation treats it as zero rather than inventing data.
- In-memory cache is ideal for this evaluation but is not shared across server instances.

## Tests

Run `npm test` to test the Comfort Index bounds and an ideal-condition case.
