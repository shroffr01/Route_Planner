# Route Planner v2

Driving-route weather forecasts, with a per-location favorability grade (A–F) at every stop.

See [`implementation.md`](./implementation.md) for the full design and rationale.

## Stack

- **Backend:** FastAPI + httpx + Redis + Shapely, Python 3.12 via [pixi](https://pixi.sh).
- **Frontend:** Next.js 15 + React 19 + TypeScript + Tailwind + Mapbox GL JS + TanStack Query + Recharts.
- **Map provider:** Mapbox (locked — see implementation.md §2).

## Repository layout

```
Route_Planner/
├─ implementation.md              ← Design doc (source of truth)
├─ pixi.toml                      ← Backend deps + tasks
├─ docker-compose.yml             ← api + redis + web
├─ apps/
│  ├─ api/                        ← FastAPI backend
│  └─ web/                        ← Next.js frontend
└─ .env.example                   ← Copy to .env and fill in keys
```

## Prerequisites

- **pixi** for the backend (already installed in this repo: `pixi --version`).
- **Node.js 20+** for the frontend.
- **A Mapbox public token** (`pk....`) — get one from <https://account.mapbox.com>.
- **An OpenWeather One Call 3.0 API key** — get one from <https://openweathermap.org/api/one-call-3>.
- (Optional) **Redis** for caching. Without it, every request hits upstream APIs.

## Setup

```powershell
# 1. Copy and fill in keys
copy .env.example .env
notepad .env       # paste your Mapbox + OpenWeather keys

# 2. Backend
pixi install                 # one time
pixi run api                 # starts http://localhost:8000 with hot reload

# 3. Frontend (in another terminal)
cd apps/web
copy .env.example .env.local
notepad .env.local           # paste the Mapbox token (same one is fine)
npm install --legacy-peer-deps
npm run dev                  # starts http://localhost:3000
```

Open <http://localhost:3000/plan>.

## Pixi tasks

```
pixi run api      # uvicorn dev server (port 8000)
pixi run test     # pytest
pixi run lint     # ruff check
pixi run fmt      # ruff format
```

(All pixi tasks set `PYTHONNOUSERSITE=1` to keep this project isolated from the
roaming user-site packages on this Windows machine.)

## Backend layout

```
apps/api/
├─ app/
│  ├─ main.py             ← FastAPI factory, CORS, /api/v1/health
│  ├─ config.py           ← Settings (pydantic-settings, .env)
│  ├─ deps.py             ← Lifespan + httpx + cache wiring
│  ├─ cache.py            ← Redis wrapper, falls through on failure
│  ├─ logging.py          ← structlog (JSON)
│  ├─ models/             ← Pydantic DTOs (geo, weather, trip)
│  ├─ services/
│  │  ├─ geocoder.py      ← Mapbox geocoding
│  │  ├─ router.py        ← Mapbox Directions + waypoint sampler (§6.4)
│  │  ├─ forecaster.py    ← OpenWeather One Call + hour-alignment
│  │  ├─ alerts.py        ← NWS alerts + polyline intersection
│  │  └─ grading.py       ← Favorability Grade (§6.3)
│  └─ routers/
│     ├─ geocode.py       ← GET  /api/v1/geocode
│     └─ trip.py          ← POST /api/v1/trip   (the orchestrator)
└─ tests/unit/            ← grading + sampler tests
```

## Frontend layout

```
apps/web/src/
├─ app/
│  ├─ layout.tsx          ← Header + Providers
│  ├─ page.tsx            ← Landing
│  └─ plan/page.tsx       ← The planner
├─ components/
│  ├─ Providers.tsx       ← TanStack Query + Theme
│  ├─ map/Map.tsx         ← Mapbox GL JS wrapper with graded markers
│  ├─ planner/
│  │  ├─ TripForm.tsx
│  │  ├─ PlaceSearch.tsx
│  │  ├─ DepartureTimePicker.tsx
│  │  ├─ GradeBadge.tsx
│  │  ├─ TripSummary.tsx
│  │  └─ Timeline.tsx     ← Recharts strip + grade band
│  └─ theme/              ← Light/dark toggle
├─ hooks/                 ← useTripMutation, useDebounced
├─ lib/                   ← api client, Zod schemas, formatters
└─ store/ui.ts            ← Zustand: shared hovered-waypoint index
```

## What works today (v1-parity bar from §13)

- [x] Pick origin / destination via address search; pick hourly departure → get a driving route.
- [x] Map is Mapbox GL JS, renders the route polyline.
- [x] **Clickable waypoint markers** at every hour of travel; popover shows temp, condition, time, UV, cloud %, wind gust, pop, visibility.
- [x] **NWS weather alerts per waypoint** — surfaced in the popover *and* drawn as polygons on the map.
- [x] **A–F favorability grade** on every marker (badge), in every popover (big), in the trip summary card, and as a colored band under the timeline.
- [x] Hourly graphs (Recharts): temperature, precipitation %, wind gust.
- [x] Synced hover: the timeline and the map highlight each other.
- [x] Light/dark theme; map style swaps with theme.
- [x] Backend: per-waypoint forecasts in parallel, Redis caching, structured logs, error envelopes.

## What's still TODO

These are scoped for follow-up iterations:

- **CSV / JSON / PDF export.** Backend has the data; the download buttons aren't wired up yet.
- **"Best departure window" mode** — call `/trip` with several candidate departures and grade each.
- **Shareable URL state** — encode form values in the querystring (`nuqs`).
- **Multi-stop routing** — the backend accepts up to 10 waypoints; the form only exposes start + end.
- **Frontend tests** — Vitest + Playwright not yet wired.
- **CI workflow** — `.github/workflows/ci.yml` not yet authored.
- **Deploy configs** — Fly.io for backend, Vercel for frontend.
- **Weather icons** — currently using emoji-free text + Grade badges; the Meteocons set referenced in §7.3 hasn't been bundled.

## Troubleshooting

**"Mapbox token not configured"** when you click *Plan trip* — your `.env` is empty
or the API server hasn't been restarted since you filled it in.

**Forecasts show but the popover says "Forecast unavailable"** — your OpenWeather
key is missing or has hit its daily quota. The grade falls back to a neutral C.

**Map is blank** — your `NEXT_PUBLIC_MAPBOX_TOKEN` in `apps/web/.env.local` is
missing. Token must be a *public* `pk.` token, not a secret `sk.` token.

**Pytest errors with `ModuleNotFoundError: No module named 'flask'`** — see
[memory/env_python_split.md](../.claude/projects/...). pixi tasks already set
`PYTHONNOUSERSITE=1`; if running pytest directly, prefix with that env var.

## Contact

shroff.rohan01@gmail.com

## License

Personal project. All rights reserved (for now).
