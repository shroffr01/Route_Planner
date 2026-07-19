# Route Planner v2

Driving-route weather forecasts, with a per-location favorability grade (A–F) at every stop —
plus live radar and official NWS/SPC/WPC hazard overlays on the map.

See [`implementation.md`](./implementation.md) for the full design and rationale.

## Stack

- **Backend:** FastAPI + httpx + Redis + Shapely, Python 3.12 via [pixi](https://pixi.sh).
- **Frontend:** Next.js 15 + React 19 + TypeScript + Tailwind + Mapbox GL JS + TanStack Query + Zustand + Recharts.
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
- (Optional) **Redis** for caching. Without it, the API falls back to an in-process
  LRU+TTL cache (`app/services/memcache.py`), so it still runs standalone.

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
notepad .env.local           # create it with NEXT_PUBLIC_MAPBOX_TOKEN and NEXT_PUBLIC_API_BASE_URL
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
│  ├─ main.py             ← FastAPI factory, CORS, routers, /api/v1/health
│  ├─ config.py           ← Settings (pydantic-settings, .env)
│  ├─ deps.py             ← Lifespan + httpx + cache wiring + overlay pre-warm loop
│  ├─ cache.py            ← Redis-backed cache_or_fetch, falls through on failure
│  ├─ logging.py          ← structlog (JSON)
│  ├─ models/             ← Pydantic DTOs (geo, weather, trip)
│  ├─ services/
│  │  ├─ geocoder.py      ← Mapbox geocoding
│  │  ├─ router.py        ← Mapbox Directions + waypoint sampler (§6.4)
│  │  ├─ forecaster.py    ← OpenWeather One Call + hour-alignment
│  │  ├─ alerts.py        ← NWS alerts + polyline intersection
│  │  ├─ grading.py       ← Favorability Grade (§6.3)
│  │  └─ memcache.py      ← Process-local LRU+TTL cache (no-Redis fallback)
│  └─ routers/
│     ├─ geocode.py       ← GET  /api/v1/geocode
│     ├─ trip.py          ← POST /api/v1/trip   (the orchestrator)
│     └─ overlay.py       ← GET  /api/v1/overlay/*  (SPC/WPC proxy, see below)
└─ tests/unit/            ← grading + sampler tests
```

### Overlay proxy (`overlay.py`)

Proxies NOAA storm-outlook products so the frontend can draw them without
CORS/latency issues (upstream NOAA responses can take 8–9s):

- `GET /api/v1/overlay/spc-day{1,2,3}` — SPC categorical convective outlook (GeoJSON).
- `GET /api/v1/overlay/wpc-ero-day{1,2}` — WPC Excessive Rainfall Outlook (GeoJSON).
- `GET /api/v1/overlay/wpc-hazards` — WPC Day 3–7 hazards (PNG image, proxied because
  the upstream server lacks CORS headers).

A background loop (`refresh_overlay_caches`, started from `app.deps.lifespan`) refreshes
every key just under its 5-minute TTL, so user requests always hit a warm cache.

## Frontend layout

```
apps/web/src/
├─ app/
│  ├─ layout.tsx          ← Header + Providers
│  ├─ page.tsx             ← Landing (+ intro animation)
│  └─ plan/page.tsx        ← The planner
├─ components/
│  ├─ Providers.tsx        ← TanStack Query + Theme
│  ├─ IntroAnimation.tsx   ← One-time animated splash on first load
│  ├─ LoadingSteps.tsx     ← Step-by-step progress while a trip is being planned
│  ├─ BottomSheet.tsx      ← Draggable mobile bottom sheet for trip details
│  ├─ ShareModal.tsx       ← Share/copy a text summary of the planned trip
│  ├─ map/
│  │  ├─ Map.tsx            ← Mapbox GL JS wrapper: route, graded markers, alert polygons
│  │  ├─ OverlayMenu.tsx    ← Toggle SPC / ERO / WPC Hazards overlays
│  │  ├─ RadarScrubber.tsx  ← Scrub HRRR radar forward along the trip timeline
│  │  └─ popupContent.ts    ← Builds marker popover HTML (forecast + grade + alerts)
│  ├─ planner/
│  │  ├─ TripForm.tsx
│  │  ├─ PlaceSearch.tsx
│  │  ├─ DepartureTimePicker.tsx
│  │  ├─ GradeBadge.tsx
│  │  ├─ TripSummary.tsx
│  │  ├─ SelectedWaypointPanel.tsx  ← Detail panel for the selected stop
│  │  └─ Timeline.tsx       ← Recharts strip + grade band
│  └─ theme/                ← Light/dark toggle
├─ hooks/                  ← useTripMutation, useDebounced
├─ lib/
│  ├─ api.ts, schemas.ts, format.ts
│  ├─ hrrr.ts              ← Picks HRRR (Iowa State IEM) radar tile frame for a given time
│  └─ route.ts
└─ store/ui.ts             ← Zustand: hover/select state, radar offset, active overlay
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
- [x] **Live HRRR radar overlay** with a scrubber to preview reflectivity at any point along the trip timeline.
- [x] **SPC / WPC hazard overlays** (convective outlook, excessive rainfall outlook, Day 3–7 hazards), proxied and cached by the backend.
- [x] **Shareable trip summary** — copy or native-share a text recap of the route, grades, and alerts.
- [x] Animated intro splash + step-by-step loading indicator while a trip is being planned.
- [x] Mobile bottom-sheet layout for trip details.
- [x] Backend: per-waypoint forecasts in parallel, Redis caching (with in-process fallback), structured logs, error envelopes.

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

**Overlay buttons spin / fail** — SPC and WPC upstream servers are slow (8–9s)
and occasionally rate-limit; the backend caches and pre-warms these, so a
persistent failure usually means NOAA is down, not the app.

**Radar tiles missing at the edges of the scrub range** — HRRR only has real
model data out to +18h (standard runs) or +48h (00/06/12/18 UTC runs); frames
outside that range clamp to the nearest available forecast hour.

**Pytest errors with `ModuleNotFoundError: No module named 'flask'`** — see
[memory/env_python_split.md](../.claude/projects/...). pixi tasks already set
`PYTHONNOUSERSITE=1`; if running pytest directly, prefix with that env var.

## Contact

shroff.rohan01@gmail.com

## License

Personal project. All rights reserved (for now).
