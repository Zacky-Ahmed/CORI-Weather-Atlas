# Weather Comfort Atlas

A server-driven weather analytics dashboard built with Express, EJS and HTMX. It obtains current conditions from OpenWeatherMap, calculates a ranked Comfort Index on the backend, and replaces only the leaderboard when a user refreshes it.

## Setup

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Create an OpenWeatherMap API key and set `OPENWEATHER_API_KEY`.
4. Run `npm install`, then `npm run dev`.
5. Visit `http://localhost:3000`.

The supplied source file contained eight cities. This project extends it to ten with London and Singapore so it meets the assignment's minimum; the legacy `Temp` and `Status` fields are intentionally ignored because the live OpenWeatherMap response is authoritative. The parser accepts the supplied `List` key and the earlier `CityList` variant.

## CORI: City Outdoor Readiness Index

CORI answers one practical question: **“How pleasant and usable is a normal 30-minute outdoor walk in this city right now?”** It is calculated only on the backend in `src/utils/comfort-index.js`; the browser only receives the result and explanation.

CORI is deliberately not a generic weighted average. Temperature, humidity, and wind affect one another in the real world, so the model treats them as an interaction before it considers air clarity and weather disruption.

### Step 1: derive dew point

OpenWeatherMap supplies temperature and relative humidity, from which CORI derives dew point using the Magnus approximation:

```text
γ = ln(relativeHumidity / 100) + (17.27 × temperature) / (237.7 + temperature)
dewPoint = (237.7 × γ) / (17.27 − γ)
```

Dew point is used because 70% humidity does not mean the same thing at 15°C and at 31°C. A higher dew point makes warm weather feel more oppressive.

### Step 2: calculate thermal strain

```text
humidityHeatPenalty = max(0, temperature − 20) × max(0, dewPoint − 12) × 0.06
coldWindPenalty = max(0, 16 − temperature) × ln(1 + windSpeed) × 0.45
hotBreezeRelief = temperature > 26 ? min(windSpeed, 4) × 1.1 : 0

effectiveTemperature = temperature
                     + humidityHeatPenalty
                     − coldWindPenalty
                     − hotBreezeRelief
```

The model deliberately behaves differently by context:

- Hot and humid air creates a larger penalty than hot dry air.
- A moderate breeze can offset heat, but only up to a limit.
- The same breeze makes cool weather less comfortable because it increases heat loss.
- The broad comfortable effective-temperature band is 18–25°C, centred around 21.5°C.

### Step 3: measure outdoor usability

CORI calculates three normalized dimensions from 0 to 1:

| Dimension | Inputs | Reasoning |
| --- | --- | --- |
| Thermal comfort | Effective temperature | The broad 18–25°C zone scores strongly; a gentle curve still distinguishes similarly pleasant cities instead of producing artificial ties. |
| Air clarity | Visibility | Uses a curved scale so improving visibility from 0.5 km to 3 km matters more than improving it from 9 km to 10 km. |
| Weather friction | OpenWeather condition code | Clear weather scores highest; cloud, drizzle, rain, snow, haze/fog, and thunderstorms progressively reduce outdoor readiness. |

### Step 4: blend dimensions without allowing compensation

```text
rawCORI = 100 × thermalScore^0.60 × clarityScore^0.15 × conditionScore^0.25
```

This geometric blend is the key design decision. It prevents excellent temperature from fully compensating for low visibility, rain, or a storm. Thermal comfort gets the largest exponent because it drives most outdoor physical comfort; condition friction gets a strong secondary role because it determines whether a walk is realistically enjoyable; visibility contributes practical orientation and safety.

### Step 5: apply safety caps

Even a good raw score is capped if conditions make outdoor plans meaningfully less safe:

| Trigger | Maximum CORI |
| --- | ---: |
| Thunderstorm | 35 |
| Visibility below 1 km | 45 |
| Effective temperature at least 38°C | 45 |
| Effective temperature at most 0°C | 45 |

The final score is rounded and constrained to 0–100. Each city card includes a backend-produced **“Why this rank”** statement so users can understand the main positive or negative conditions, rather than trusting a black-box number.

### Design boundaries and future extension

CORI is an explainable outdoor-readiness metric, not a medical heat-stress index and not a recreation of UTCI. Professional thermal-comfort models also use solar radiation and mean radiant temperature, which are not available from this OpenWeatherMap current-weather endpoint. The planned live-demo extension is **Sky Moderation**: using cloudiness as a modest shade proxy, while clearly documenting that it is not direct radiation measurement.

## Cache design

Raw OpenWeatherMap responses are cached in memory for 300 seconds with `node-cache`. The cache is keyed by city ID, so one unavailable city does not invalidate the rest. `GET /api/cache-status` reports cache keys and the most recent `HIT` or `MISS` for each key.

The processed ranking is recalculated from cached raw data. This avoids stale derived data while keeping API calls low. For a multi-instance production deployment, Redis would replace the in-memory cache.

## Auth0 submission configuration

Set `AUTH_ENABLED=true`, create an Auth0 **Regular Web Application**, then configure callback URL `http://localhost:3000/callback` and logout URL `http://localhost:3000`. Add Auth0 credentials to `.env`.

In Auth0, disable public sign-ups, create the required `careers@fidenz.com` test user, and enable email MFA. Auth0 tenant configuration cannot safely be committed as code, so document the final tenant settings with screenshots or this checklist.

## Trade-offs and limitations

- HTMX keeps the client small and the server as the source of truth, but it is less appropriate than a SPA for complex client-side state.
- The free weather API is subject to rate limits and may have delayed activation after key creation.
- Visibility may be absent for some stations. CORI does not invent a visibility measurement; an absent value is treated as low-confidence clarity and is visible in the underlying weather response.
- In-memory cache is ideal for this evaluation but is not shared across server instances.

## Tests

Run `npm test` to test the CORI ideal case, dew-point interaction, hot/cold wind behavior, safety caps, and score bounds.
