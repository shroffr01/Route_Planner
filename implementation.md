# Route Planner v2 — Implementation Plan

> **Project codename:** Route_Planner
> **Replaces:** the Streamlit prototype at `C:\Users\shrof\.vscode\PersonalProject` (`website.py`, 726 lines)
> **Author:** Rohan Shroff
> **Status:** Design / pre-implementation
> **Date:** 2026-05-10

---

## 1. Executive summary

The v1 Streamlit app (henceforth "the prototype") proved out a genuinely useful idea: **given a driving route and a departure time, show what the weather will be at each point along the route at the time the driver actually arrives there.** The hardest pieces — sampling the polyline by travel time, aligning each sample to the right forecast hour, and rendering the result on a Mapbox map with custom condition icons — all work.

The prototype is also a textbook example of what Streamlit was designed for: get an idea on screen in one afternoon. It is not a base to grow into a real product. Reasons, briefly:

- **One 726-line module** with deeply nested closures; route, weather, alerts, icons, and UI rendering are all entangled.
- **No frontend control.** Streamlit owns the layout, the page transitions, the form re-runs, and the styling. Polishing past a certain point fights the framework.
- **No caching, no retries, no error surface.** Every interaction re-hits Mapbox + OpenWeather + NWS. A failed API call crashes the page (`data['routes'][0]` on an empty response).
- **Geocoding is a 30k-row CSV of US cities** loaded on every render. Non-US trips, addresses, ZIPs, and POIs are impossible.
- **Secrets are wired into the rendered HTML.** The Mapbox public token is fine to embed (that's its purpose), but the pattern doesn't generalize — there's nowhere safe to keep a server-side key.
- **No tests, no types, no logging, no deployable artifact** beyond `streamlit run`.

**v2 is a ground-up rewrite** with three goals, in order:

1. **Make it feel like a real product.** Custom UI, fast first paint, animation where it earns its keep. Desktop-first responsive web — no mobile app, no PWA.
2. **Make it extensible.** A backend that owns API integrations and caching, a frontend that owns rendering. New features should land in one of those two halves without changing both.
3. **Make it learnable for me.** This is also a portfolio project — the stack should be something a hiring manager recognizes and I can defend in an interview.

### Hard constraints (locked in)

These came from the v1 → v2 conversation and are not up for re-debate without my say-so:

- **Web only.** No native mobile, no PWA, no offline mode. The product is a website that runs in a desktop or tablet browser. Mobile-browser layout is supported but is not a design driver.
- **Mapbox stays.** Mapbox GL JS for rendering and Mapbox Directions for routing. Do not propose MapLibre / OSRM / Leaflet swaps as part of v2.
- **All v1 interactions survive the rewrite.** In particular: clickable map markers at each waypoint that open a detailed weather popup; NWS weather alerts surfaced at each city, not just the origin; and a per-location favorability grade so the user can see at a glance which stops on the route are good or bad. v2 enhances each of these but never removes them. See §13 for the parity checklist and §6.3 for the grading spec.

---

## 2. Goals and non-goals

### In scope for v2

**Carried over from v1 (must work on day one of v2):**

- Origin / destination selection and a driving route between them.
- Hourly departure-time picker.
- A Mapbox map with one custom weather icon at every hour of travel along the route.
- **Clickable markers** at each waypoint that open a detailed popup (temperature, condition, time, UV, cloud cover, wind gust, probability of precipitation).
- **NWS weather alerts per city** along the route, not just at the start.
- Trip-level CSV download.
- Hourly weather graphs alongside the map.

**New in v2:**

- Address / place-name search (not a fixed city list) with autocomplete.
- Multi-stop routing (start + N waypoints + end).
- A **Weather Favorability Grade (A–F)** shown on each waypoint marker and inside its popup, plus a trip-level rollup grade. This formalizes the "is this stop good or bad" signal the user asked for and replaces the v1 generic icon with a graded one.
- NWS alerts intersected with the **entire polyline**, not just the cities the user typed in — including alert polygons drawn on the map.
- Departure-time picker with a "find best departure window in the next 24 h" mode that grades each candidate departure.
- A timeline / strip chart synchronized with the map (hover a hour → highlight the matching marker, and vice versa).
- JSON and printable PDF export in addition to CSV.
- Shareable trip URLs (state encoded in querystring).
- Light/dark mode and a polished design system.
- Public deploy with a custom domain.

### Explicitly out of scope (for v2.0)

- User accounts, saved trips, push notifications. (v2.1.)
- Live traffic re-routing. (Mapbox does support this; out of scope to keep v2 focused.)
- Anything outside drive-by-car (no transit, no flights).
- ML-based "is this drive safe" — the favorability grade is heuristic in v2; ML in v3 if data justifies it.

### Non-goals (will not do, even later)

- **No native mobile app and no PWA.** The product is a website. The browser is the runtime.
- **No swapping Mapbox.** Mapbox GL JS and Mapbox Directions are the locked-in choices for rendering and routing. The Mapbox account is the place I'll spend money if usage grows.
- Replacing the forecast model with our own. We are a consumer of NWS / OpenWeather.
- Building our own map tile server.

---

## 3. Tech stack

The single biggest decision. I considered three paths:

| Stack | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **A. Stay in Python: FastAPI + a Python UI lib (NiceGUI / Reflex / Dash)** | Don't learn a new language. | None of these give the UI quality I want; same Streamlit ceiling, different paint. | Reject |
| **B. Pure Next.js (TypeScript) full-stack** | One language, one repo, Vercel-native deploy. Server actions / route handlers can do the API orchestration. | Loses the Python data-tooling I'm already fluent in (pandas, pytz, timezonefinder). Pixi becomes irrelevant. | Reject |
| **C. FastAPI backend + Next.js frontend** | Python keeps the data/forecast logic where I'm productive. Frontend gets a real framework. Each half is independently deployable, testable, and replaceable. Pixi manages the backend cleanly. | Two languages, two deploy targets, CORS. Worth it. | **Adopt** |

### Final stack

**Backend (Python, pixi-managed)**
- **Python 3.12**
- **FastAPI** + **uvicorn** — async HTTP, automatic OpenAPI docs at `/docs`.
- **httpx** (async) — the only outbound HTTP client. Replaces `requests`.
- **pydantic v2** — request/response models, settings.
- **pydantic-settings** — `.env` → typed config, no more `st.secrets`.
- **redis** (via `redis-py`) — response cache for Mapbox/OWM/NWS calls. Local fakeredis in dev/tests.
- **timezonefinder**, **pytz** — kept from v1.
- **structlog** — JSON logs.
- **pytest** + **pytest-asyncio** + **respx** (httpx mock) for tests.
- **ruff** + **mypy** for lint + types.

**Frontend (TypeScript, npm/pnpm)**
- **Next.js 15 (App Router)** + **React 19** + **TypeScript**.
- **Tailwind CSS v4** + **shadcn/ui** for the component library (Radix-based, accessible, themeable).
- **Mapbox GL JS** for the map. Mapbox is the locked-in choice; we are not evaluating alternatives for v2.
- **TanStack Query** for server-state, caching, retries on the client.
- **Zustand** for any client-only UI state (drawer open, units, theme override).
- **Recharts** (or **visx**) for the timeline strip and the trip-grade band. (Plotly leaves; it's too heavy and not Tailwind-friendly.)
- **Zod** for runtime validation at the API boundary.
- **Vitest** + **Playwright** for unit + E2E.
- **ESLint** + **Prettier**.

**Infra**
- **Docker** for both halves; one `docker-compose.yml` for local dev (api + redis + web).
- **GitHub Actions** for CI (lint, type, test on every PR; build images on `main`).
- **Backend deploy:** Fly.io or Render. Both give a free-ish Postgres/Redis if I add them later.
- **Frontend deploy:** Vercel (free hobby tier, zero-config Next.js).
- **Secrets:** `.env` locally; Fly secrets / Vercel env vars in prod. Never committed.

### Why pixi (and how it fits)

Pixi is already initialized at `C:\Users\shrof\.vscode\Route_Planner`. It will manage the **backend** Python environment via `pixi.toml`. The frontend will use `pnpm` and live in `apps/web/` — pixi will not touch it.

Pixi tasks become my command palette:

```toml
[tasks]
api          = "uvicorn app.main:app --reload"
test         = "pytest -q"
lint         = "ruff check . && mypy app"
fmt          = "ruff format ."
dev          = { cmd = "docker compose up", description = "Run api + redis + web together" }
```

So `pixi run api` boots the backend. No global pip, no Python-version confusion (the issue we just hit with Streamlit on this machine).

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Browser (Next.js client)                      │
│  - Map (Mapbox GL JS)                                               │
│  - Timeline / grade strip                                           │
│  - Forms, popups, theme                                             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTPS / JSON
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                Next.js server (Route Handlers / RSC)                │
│  - Renders shell, handles auth (later), proxies safe-to-cache calls │
│  - NEVER holds private API keys; those live behind the FastAPI      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTPS / JSON
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          FastAPI backend                            │
│  /api/v1/geocode      → Mapbox Geocoding (search-as-you-type)       │
│  /api/v1/route        → Mapbox Directions, returns waypoints        │
│  /api/v1/forecast     → OpenWeather One Call per waypoint           │
│  /api/v1/alerts       → NWS alerts intersected with polyline        │
│  /api/v1/trip         → orchestrates all of the above in one call   │
│                                                                     │
│         ┌───────────────────────────────────────────────┐           │
│         │  Service layer (geocoder, router, forecaster, │           │
│         │  alerts, grader)                              │           │
│         └─────────────────────┬─────────────────────────┘           │
│                               ▼                                     │
│         ┌───────────────────────────────────────────────┐           │
│         │            Cache (Redis, 10–60 min TTL)       │           │
│         └─────────────────────┬─────────────────────────┘           │
└───────────────────────────────┼─────────────────────────────────────┘
                                ▼
                  Mapbox │ OpenWeather │ api.weather.gov
```

### Why a backend at all?

1. **Hide and rate-limit the OpenWeather key.** Putting it in the browser would let anyone exhaust the quota.
2. **Cache.** Forecasts change on the hour, not on every page reload. Redis-cache the upstream responses by `(lat,lon,hour)` and serve dozens of users from one upstream call.
3. **Compose.** The frontend wants one POST `/trip` returning a clean DTO; orchestrating three upstream APIs in the browser is fragile.
4. **Swap upstreams without touching the UI.** If OpenWeather pricing changes, the forecaster service swaps to NWS gridpoints (we already have that code in the prototype's page1).

---

## 5. Repository structure

```
Route_Planner/
├─ implementation.md              ← this doc
├─ README.md
├─ .gitignore
├─ .gitattributes
├─ pixi.toml                      ← backend deps + tasks
├─ pixi.lock
├─ docker-compose.yml             ← api + redis + web
│
├─ apps/
│  ├─ api/                        ← FastAPI backend
│  │  ├─ pyproject.toml
│  │  ├─ Dockerfile
│  │  ├─ app/
│  │  │  ├─ main.py               ← FastAPI factory, middleware, routers
│  │  │  ├─ config.py             ← pydantic-settings, .env loader
│  │  │  ├─ deps.py               ← DI: httpx client, redis, settings
│  │  │  ├─ routers/
│  │  │  │  ├─ geocode.py
│  │  │  │  ├─ route.py
│  │  │  │  ├─ forecast.py
│  │  │  │  ├─ alerts.py
│  │  │  │  └─ trip.py            ← orchestrator endpoint
│  │  │  ├─ services/
│  │  │  │  ├─ geocoder.py        ← Mapbox geocoding wrapper
│  │  │  │  ├─ router.py          ← Mapbox directions + waypoint sampler
│  │  │  │  ├─ forecaster.py      ← OpenWeather One Call + hour-alignment
│  │  │  │  ├─ alerts.py          ← NWS alerts, polyline intersection
│  │  │  │  └─ grading.py         ← favorability score + letter grade per waypoint
│  │  │  ├─ models/               ← pydantic DTOs (request + response)
│  │  │  │  ├─ geo.py
│  │  │  │  ├─ trip.py
│  │  │  │  └─ weather.py
│  │  │  ├─ cache.py              ← redis wrapper, cache_key helpers
│  │  │  └─ logging.py            ← structlog setup
│  │  └─ tests/
│  │     ├─ unit/                 ← pure-function tests (grader, sampler)
│  │     ├─ integration/          ← respx-mocked upstream tests
│  │     └─ fixtures/             ← canned Mapbox/OWM/NWS responses
│  │
│  └─ web/                        ← Next.js frontend
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ tailwind.config.ts
│     ├─ Dockerfile
│     ├─ public/
│     │  └─ icons/                ← weather-condition SVGs (replace v1 PNGs)
│     ├─ src/
│     │  ├─ app/
│     │  │  ├─ layout.tsx
│     │  │  ├─ page.tsx           ← landing
│     │  │  ├─ plan/
│     │  │  │  └─ page.tsx        ← main planner
│     │  │  └─ api/               ← thin Next route handlers if needed
│     │  ├─ components/
│     │  │  ├─ ui/                ← shadcn primitives (button, dialog, etc.)
│     │  │  ├─ map/
│     │  │  │  ├─ Map.tsx
│     │  │  │  ├─ WaypointMarker.tsx
│     │  │  │  └─ AlertLayer.tsx
│     │  │  ├─ planner/
│     │  │  │  ├─ TripForm.tsx
│     │  │  │  ├─ PlaceSearch.tsx
│     │  │  │  ├─ DepartureTimePicker.tsx
│     │  │  │  ├─ Timeline.tsx
│     │  │  │  ├─ GradeBadge.tsx
│     │  │  │  └─ TripSummary.tsx
│     │  │  └─ theme/
│     │  │     └─ ThemeToggle.tsx
│     │  ├─ hooks/
│     │  │  ├─ useTrip.ts         ← TanStack Query hook
│     │  │  └─ useDebounced.ts
│     │  ├─ lib/
│     │  │  ├─ api.ts             ← typed client to FastAPI
│     │  │  ├─ schemas.ts         ← Zod schemas mirroring backend DTOs
│     │  │  └─ format.ts          ← °F/°C, mph/kph, time formatting
│     │  └─ store/
│     │     └─ ui.ts              ← Zustand store (units, theme)
│     └─ tests/
│        ├─ unit/                 ← Vitest
│        └─ e2e/                  ← Playwright
│
├─ packages/
│  └─ shared-types/               ← OPTIONAL: OpenAPI-generated TS types
│                                    so the frontend and backend share DTOs
│
└─ .github/
   └─ workflows/
      ├─ ci.yml                   ← lint + test on PR
      └─ deploy.yml               ← build + push on main
```

---

## 6. Backend design

### 6.1 Endpoints (REST, JSON, versioned)

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/api/v1/health` | Liveness. |
| GET  | `/api/v1/geocode?q=<text>&proximity=<lat,lon>` | Search-as-you-type. Returns up to 5 places. |
| POST | `/api/v1/route` | Body: `{ waypoints: [{lat,lon}], depart_at }`. Returns route polyline + duration + leg breakdown. |
| POST | `/api/v1/forecast` | Body: `{ samples: [{lat,lon,at}] }`. Returns aligned hourly forecast per sample. |
| POST | `/api/v1/alerts` | Body: `{ polyline, window: [start,end] }`. Returns intersecting NWS alerts. |
| POST | `/api/v1/trip` | **The orchestrator.** Body: planner form. Returns the full DTO the frontend renders. |

`/trip` is the only endpoint the frontend uses in the common path. The others exist so each capability is independently testable and so the frontend can stream partial results later (route first, forecast later) if I want.

### 6.2 Trip response DTO (shape, not exhaustive)

```jsonc
{
  "route": {
    "distance_m": 712340,
    "duration_s": 27840,
    "polyline_geojson": { "type": "LineString", "coordinates": [...] },
    "bounding_box": [minLon, minLat, maxLon, maxLat]
  },
  "waypoints": [
    {
      "index": 0,
      "lat": 38.0293, "lon": -78.4767,
      "arrival": "2026-05-10T15:00:00-04:00",
      "place_label": "Charlottesville, VA",
      "forecast": {
        "temp_f": 71, "feels_like_f": 70,
        "pop_pct": 20, "wind_mph": 8, "wind_gust_mph": 14,
        "visibility_mi": 10, "cloud_pct": 35, "uv": 5,
        "condition_code": "02d", "summary": "Partly cloudy"
      },
      "grade": { "letter": "B", "score": 12, "reasons": [] },
      "active_alerts": []
    }
  ],
  "alerts": [
    {
      "event": "Severe Thunderstorm Warning",
      "headline": "...",
      "severity": "Severe",
      "starts_at": "...", "ends_at": "...",
      "polygon_geojson": { ... },
      "intersects_waypoints": [3, 4]
    }
  ],
  "trip_grade": { "letter": "C", "score": 34, "worst_waypoint": 4 }
}
```

### 6.3 Weather Favorability Grade (new in v2 — the user-facing form of "hazard")

Every waypoint gets a letter grade **A–F** based on how favorable conditions are for driving. The trip as a whole gets a rollup grade (worst-waypoint dominates, weighted slightly toward duration spent near it). This is what the user sees on the map and on the timeline — the raw numeric score is internal.

**Internal numeric score (0–100, 0 = perfect):** sum the weighted contributions below, clamp to 0–100.

| Signal | Weight contribution |
| --- | --- |
| Precipitation probability | up to 25 |
| Wind gust > 30 / 45 / 60 mph | 10 / 20 / 30 |
| Temperature ≤ 32 °F + any precip → ice risk | +25 |
| Visibility < 3 mi / < 1 mi | 10 / 25 |
| Active NWS alert touching this waypoint | by severity: 10–40 |
| Snowfall amount > 0.5 in/hr | +20 |

**Score → grade mapping:**

| Score | Grade | Meaning | Pill color |
| --- | --- | --- | --- |
| 0–9   | **A** | Clear and easy | green |
| 10–24 | **B** | Generally fine, minor stuff | lime |
| 25–44 | **C** | Worth knowing about | amber |
| 45–69 | **D** | Drive carefully or delay | orange |
| 70–100| **F** | Don't go if you can avoid it | red |

**Why a letter grade and not the raw number:** a driver glancing at the map needs to compare ten waypoints in one second. "B, B, C, D, D, C, B" is parseable; "12, 18, 31, 52, 47, 28, 19" is not. The raw score is still in the DTO for anyone who wants it (and for the timeline chart).

All thresholds and the score→grade mapping live in `services/grading.py` and are individually unit-tested. Each grade carries a reason list — "Wind gusts to 48 mph", "Active Winter Storm Warning" — that powers the human-readable detail in the popup.

**Where the grade appears in the UI** (kept consistent so users learn it in one place):

- On the map marker itself, as a small colored badge in the corner of each weather icon.
- In the marker popup, big at the top: "Grade: B — Wind gusts to 28 mph".
- In the trip summary card.
- On the timeline, as a colored band below the chart.
- In the "best departure window" view, one grade per candidate departure time.

### 6.4 Waypoint sampler — fixing a v1 bug

The prototype samples by walking step-coordinate-by-step-coordinate and asking "did cumulative time cross the next hour boundary?" That works *most* of the time but:

- The sampler can miss the final hour boundary if the route ends mid-step.
- It treats each step's coordinates as evenly-spaced in time, which they aren't (a step's coordinates can be much denser at curves).

v2 implementation:

1. From Mapbox Directions, take `legs[*].annotation.duration` (request `annotations=duration`) — durations *per segment*, exact.
2. Build a cumulative-duration array along the polyline.
3. For each desired offset (3600s, 7200s, ...), `np.searchsorted` into the array, then **interpolate linearly** between the two bracketing coordinates.
4. Always append the destination as the final waypoint regardless of whether it lands on a boundary.

This is ~15 lines of NumPy and is trivial to unit-test against synthetic polylines.

### 6.5 Caching strategy

- **Geocode:** TTL 24 h, key `geocode:{q}:{proximity}`.
- **Route:** TTL 30 min, key `route:{waypoints_hash}:{depart_at_hour}`.
- **Forecast:** TTL 30 min, key `forecast:{lat_rounded_to_0.1}:{lon_rounded_to_0.1}:{hour_iso}`. The 0.1° rounding (~7 mi) is enough to dramatically increase hit rate without making the forecast wrong.
- **Alerts:** TTL 5 min, keyed by bounding box rounded to 0.5°.

All cache reads are wrapped in a `cache_or_fetch(key, ttl, fetch_fn)` helper. If Redis is down, we log a warning and fall through to the upstream — caching is never on the critical path.

### 6.6 Error handling

- Upstream timeouts (httpx) → return `503` with a structured `{ error_code, message, retry_after }`.
- Mapbox returns `NoRoute` (e.g., two points across an ocean) → `422` with a friendly message.
- OpenWeather quota exceeded → `503` with `retry_after`; frontend shows "weather service temporarily unavailable" without blowing up the route view.
- Per-endpoint timeout budget; the `/trip` endpoint must respond within ~6 s even if one upstream is slow (use `asyncio.gather` with `return_exceptions=True`).

### 6.7 Security

- All API keys server-side. Mapbox **client** token (public, URL-restricted to my domain) is the only secret the frontend sees.
- CORS: explicit allowlist (`https://routeplanner.app`, `http://localhost:3000`).
- Rate limit per IP (slowapi or a simple Redis token bucket): 60 req/min on `/trip`, 600/min on `/geocode`.
- No PII collected in v2. If I add accounts in v2.1, the design is ready (hash sub on JWT, no email storage).

---

## 7. Frontend design

### 7.1 Page inventory

- `/` — Landing. One sentence, one CTA ("Plan a trip"), one screenshot.
- `/plan` — The product. URL-shareable; the entire trip state lives in querystring (`?from=…&to=…&depart=…`).
- `/about` — One paragraph, links to data providers.

### 7.2 `/plan` layout

This is a website, not an app. The layout is **designed for desktop and laptop browsers** and gracefully reflows down to tablet width. There is no mobile-app layout, no bottom sheet, and no PWA install path.

Desktop / laptop (the primary target — ≥ 1024 px):

```
┌──────────────────────────────────────────────────────────────────┐
│ Logo        Plan        About                      Theme   Units │
├────────────────────────────┬─────────────────────────────────────┤
│  TripForm                  │                                     │
│  ┌──────────────────────┐  │                                     │
│  │ From  [search...]    │  │                                     │
│  │ To    [search...]    │  │              MAP                    │
│  │ + Add stop           │  │  (Mapbox; graded icons,             │
│  │ Depart  [picker]     │  │   click → detailed weather popup,   │
│  │ [ Plan trip ]        │  │   alert polygons overlaid)          │
│  └──────────────────────┘  │                                     │
│                            │                                     │
│  TripSummary               │                                     │
│  ┌──────────────────────┐  │                                     │
│  │ 7h 44m · 442 mi      │  │                                     │
│  │ Trip grade: C        │  │                                     │
│  │ ⚠ Storm warning ...  │  │                                     │
│  └──────────────────────┘  │                                     │
├────────────────────────────┴─────────────────────────────────────┤
│  Timeline (hour-by-hour temp / precip / wind, graded band,       │
│   hover syncs map ↔ chart)                                       │
└──────────────────────────────────────────────────────────────────┘
```

Tablet (768–1023 px): the left column shrinks but stays on screen; the map narrows but doesn't move. Below 768 px the form stacks above the map. We do not invest in a phone-optimized layout — phone users will see a usable, scrollable page, not a hand-tuned one.

### 7.3 Design system

- **Typography:** Inter (variable). Sizes via Tailwind's default scale.
- **Color:** Tailwind's `zinc` for surfaces; `sky-500` as primary action. Grade pills use a fixed palette (A green, B lime, C amber, D orange, F red — see §6.3). Dark mode uses `zinc-950` background, `zinc-100` text. Both modes pass WCAG AA on every text-on-surface combo.
- **Components:** shadcn/ui (Button, Dialog, Command, Tooltip, Toast, Popover). I don't roll my own primitives.
- **Map style:** Mapbox `streets-v12` for light, `dark-v11` for dark — bound to theme.
- **Motion:** Framer Motion only for the popover transitions and the timeline scrub indicator. No motion on data; jittery charts feel cheap.
- **Icons:** Replace the 10 PNGs from v1 with the open-source [Meteocons](https://bas.dev/work/meteocons) SVG set, served from `/public/icons`. One SVG per OWM condition code, with a `currentColor` fill so it themes correctly.

### 7.4 Key components (sketch)

**`PlaceSearch.tsx`** — debounced (250 ms) input hitting `/api/v1/geocode`, dropdown using `Command` from shadcn, keyboard-navigable, selects emit `{label, lat, lon}`.

**`DepartureTimePicker.tsx`** — three modes via tabs: "Now", "Today at...", "Find best window". The third option calls `/trip` with several candidate departures and shows the **trip-grade** for each candidate departure hour, side by side.

**`Map.tsx`** — Wraps Mapbox GL JS. Imperative API kept inside an effect; the component takes typed props (`route`, `waypoints`, `alerts`) and the effect diffs and updates layers. **Each waypoint is a clickable marker** rendered as a React component portaled into Mapbox via `marker.getElement().appendChild`. A click opens a popover with the detailed forecast (temp, condition, time, UV, cloud cover, wind gust, probability of precip, visibility) plus the waypoint's letter grade and any active NWS alerts that intersect that specific point — same content shown by the timeline tooltip, so the user never sees two versions of "the truth" for one stop.

**`Timeline.tsx`** — Recharts (or visx) composed chart: line for temp, area for pop, bars for wind gust. Below the chart is a colored band of letter grades, one cell per waypoint, so a user can scan the whole trip in one glance. Hover emits `onHoverWaypointIndex` to a Zustand store; `Map.tsx` subscribes and highlights the corresponding marker. This bidirectional hover is the single biggest "feels like a product" UX upgrade over v1.

**`GradeBadge.tsx`** — Color-coded A–F pill with the score and reason list on hover. Used in `TripSummary`, on each marker (as a corner badge), and inside marker popovers. One component, three call sites — never re-implemented.

### 7.5 State management

- **Server state** (route, forecast, alerts): TanStack Query. One query keyed on the form input; the query function calls `/api/v1/trip`. Cache time 30 min on the client too, matching the backend.
- **URL state** (form values): `nuqs` or hand-rolled `useSearchParams` — the form *is* the URL. Shareable, back-button-friendly.
- **UI state** (theme, units, hovered waypoint): Zustand. Persisted to `localStorage` where appropriate.

### 7.6 Accessibility

- All interactive controls keyboard-reachable.
- Map has a text-mode fallback (a list view of waypoints with the same info), toggleable, for screen-reader users.
- Color is never the only signal — grade pills carry the letter (A–F) in addition to the color.
- All images have alts; SVG icons get `aria-label` when they convey meaning.

---

## 8. Feature delta — what's new vs the prototype

| Capability | v1 (prototype) | v2 |
| --- | --- | --- |
| Origin / destination input | Dropdown of US cities from CSV | Address / place / POI search anywhere |
| Stops | 1 (start + end) | Up to 9 (start + 8 waypoints) |
| Departure time | 5 h ago → 24 h ahead, hourly | Any datetime, plus "best window" finder |
| Route sampler | Every-coord walk, can miss boundaries | Duration-annotated, interpolated, exact |
| Map renderer | Mapbox GL JS, inline HTML f-string | Mapbox GL JS as a real React component (Mapbox stays) |
| Clickable waypoint markers | ✔ Yes — popup with weather details | ✔ Kept and improved: bigger popover, alerts inline, A–F grade |
| Forecast source | OWM One Call 3.0 | Same, with NWS gridpoints as fallback |
| Alerts | NWS at start city only | NWS at **every waypoint**, surfaced in the popover **and** drawn as polygons on the map |
| Per-location grade | None | A–F favorability grade on every marker, in every popover, and in the trip summary |
| Charts | Plotly, 2 fixed plots | Synced timeline that talks to the map, with the grade band underneath |
| Theme | Streamlit default | Light/dark, themed map |
| Form factor | Streamlit-default reflow | Desktop-first responsive website; tablet supported; no mobile/PWA |
| Sharing | None | URL encodes full trip state |
| Export | CSV | CSV, JSON, printable PDF |
| Caching | None | Redis with sensible TTLs |
| Auth / saved trips | None | Out of scope for v2.0; designed for v2.1 |
| Tests | None | pytest (backend), Vitest + Playwright (frontend) |
| Observability | None | Structured logs, request IDs, basic Prom-style metrics |
| Deploy | `streamlit run` locally | Vercel + Fly.io / Render |

---

## 9. Data flow — `/trip` end-to-end

1. User submits the form → `useTrip` mutation fires `POST /api/v1/trip`.
2. Backend validates with pydantic.
3. **Geocode** any waypoints that came in as text labels (cache: 24 h).
4. **Route** → Mapbox Directions with `annotations=duration` (cache: 30 min).
5. Sampler picks one waypoint per hour of travel + the final destination.
6. **Forecast** for all sample points in parallel via `asyncio.gather` (cache: 30 min, rounded coord + hour key).
7. **Alerts** for the route's bbox (cache: 5 min), then a Shapely intersection of each alert polygon with the polyline + a buffer.
8. **Favorability grade** computed per waypoint (numeric score → letter A–F), then rolled up to a trip grade.
9. Assembled DTO returned.
10. Client renders map + timeline + summary; TanStack Query caches the response.

Expected p50 latency for a fresh request: ~1.5–2.5 s. For a cached request: ~150 ms.

---

## 10. Testing strategy

**Backend**
- Unit: grader (table-driven, score thresholds + letter mapping), waypoint sampler (synthetic polylines + known durations), cache key helpers.
- Integration: each service, with `respx` mocking the upstream. Snapshot the DTO for a canned Mapbox + OWM + NWS triple.
- Contract: a pytest test loads the OpenAPI schema and asserts every response model is referenced from a router.
- Target: 80% line coverage on `app/services/` and `app/routers/`. UI-coupled glue is exempt.

**Frontend**
- Unit (Vitest): pure functions (`format.ts`, grade pill mapper), and React Testing Library for `TripForm` validation logic, `PlaceSearch` debouncing.
- E2E (Playwright): one happy-path test that types into the form, asserts the map has markers, asserts the timeline renders, asserts the trip URL is shareable.
- Visual regression: optional, via Playwright screenshots in CI (skip in v2.0; revisit if I keep redesigning).

---

## 11. CI / CD

`.github/workflows/ci.yml` runs on every PR:

```
backend:
  - pixi install
  - pixi run lint
  - pixi run test
frontend:
  - pnpm install
  - pnpm typecheck
  - pnpm lint
  - pnpm test
  - pnpm exec playwright install --with-deps && pnpm e2e
```

`.github/workflows/deploy.yml` runs on push to `main`:

- Build backend image, push to GHCR, deploy to Fly.io (`flyctl deploy`).
- Vercel auto-deploys frontend from `main` (no workflow needed).
- Tag the commit with the deploy date for rollback hygiene.

---

## 12. Configuration & secrets

`apps/api/app/config.py`:

```python
class Settings(BaseSettings):
    mapbox_token: SecretStr
    openweather_api_key: SecretStr
    redis_url: AnyUrl = "redis://localhost:6379/0"
    cors_origins: list[str] = ["http://localhost:3000"]
    log_level: str = "INFO"
    model_config = SettingsConfigDict(env_file=".env", env_prefix="ROUTEPLANNER_")
```

- `.env.example` checked in.
- Real `.env` git-ignored (already covered by the existing `.gitignore`).
- Fly secrets via `flyctl secrets set`.
- Vercel: `NEXT_PUBLIC_MAPBOX_TOKEN` (URL-restricted public token) and `NEXT_PUBLIC_API_BASE_URL`.

---

## 13. Migration / parity checklist

Things from v1 that **must** work in v2 before the Streamlit prototype is retired. These are the interactions the user explicitly wants preserved, and they are non-negotiable:

- [ ] Pick a starting point, a destination, and an hourly departure → get a driving route with a weather icon at every hour of travel.
- [ ] **Map is Mapbox.** Mapbox GL JS renders the route line and the markers.
- [ ] **Clicking any waypoint marker on the map opens a popover** with the detailed forecast for that point: temperature, condition icon, condition text (e.g. "light rain"), local arrival time, UV index, cloud cover %, wind gust, probability of precipitation, visibility.
- [ ] **NWS weather alerts for each city** along the route surface in the UI — both inside that waypoint's popover and as polygons on the map. v1 only showed alerts for the origin city; v2 keeps that behavior and extends it to every waypoint plus the route polyline itself.
- [ ] **A weather favorability grade is shown at every location on the map** (A–F badge on each marker, restated in the popover, and rolled up to a trip-level grade in the summary). This is the explicit "is this stop good or bad" signal the user asked for.
- [ ] Trip-level CSV export of the per-hour weather table.
- [ ] Hourly weather graphs (temp / feels-like / dew point; humidity / pop / clouds) live alongside the map.

Things that **stay broken on purpose** (rather than ported as-is):

- The `httpbin.org/user-agent` round-trip on every request. v2 sends a real, fixed `User-Agent` per NWS guidelines.
- The hardcoded city CSV. v2 uses Mapbox geocoding.

---

## 14. Milestones

Targeting calendar weeks. Adjust to reality.

**M1 — Foundation (1 week)**
- Repo layout, pixi tasks, docker-compose, lint/format/test pre-commit.
- FastAPI skeleton with `/health` + OpenAPI docs.
- Next.js scaffold with Tailwind + shadcn, theme toggle, landing page.

**M2 — Backend services (1.5 weeks)**
- Geocoder, router, forecaster, alerts services with respx tests.
- `/trip` orchestrator with `asyncio.gather`.
- Redis caching layer.
- Favorability grading (numeric score + A–F letter) with unit tests.

**M3 — Frontend MVP (2 weeks)**
- `PlaceSearch`, `TripForm`, `DepartureTimePicker`.
- `Map` component with route line + waypoint markers + popups.
- `Timeline` with map sync.
- `TripSummary` + `GradeBadge`.

**M4 — Polish (1 week)**
- Tablet reflow, animation pass, empty / error / loading states.
- Light/dark map style swap.
- Shareable URL state.
- CSV + JSON + PDF export.

**M5 — Ship (0.5 week)**
- Fly.io + Vercel deploy.
- Custom domain.
- README with screenshots + architecture diagram.
- Retire the Streamlit prototype (archive `PersonalProject` branch).

**Total: ~6 weeks of focused side-project time.**

---

## 15. Stretch goals (post-v2.0)

- **Accounts & saved trips** (Clerk or Auth.js + a tiny Postgres).
- **"Notify me when conditions improve"** — email when a saved trip's grade rises above a chosen threshold within a chosen window.
- **Multi-modal**: cycling and walking profiles (already supported by Mapbox; the model & icons stay the same).
- **Historical analog**: "the last time conditions on this route looked like this, what happened?" — pulls NWS Storm Events. This is the ML-adjacent feature; defer until the dataset proves itself.

---

## 16. Open questions to resolve before M2

- ~~Mapbox vs MapLibre.~~ **Decided: Mapbox.** Locked in. Set a hard $ alert on the Mapbox account before going public.
- **PDF export library.** `@react-pdf/renderer` (client) vs server-side `weasyprint`. Tentative: server-side, so the report can be linked.
- **Auth provider for v2.1.** Clerk gives the best DX; Auth.js is free and self-contained. Defer.
- **Tile-cost ceiling.** Set a hard $ alert on the Mapbox account before going public.

---

## 17. References

- v1 prototype: `C:\Users\shrof\.vscode\PersonalProject\website.py`
- Mapbox Directions API: <https://docs.mapbox.com/api/navigation/directions/>
- OpenWeather One Call 3.0: <https://openweathermap.org/api/one-call-3>
- NWS API: <https://www.weather.gov/documentation/services-web-api>
- shadcn/ui: <https://ui.shadcn.com/>
- pixi docs: <https://pixi.sh/>
