# Route Planner

**[shroffr01.github.io/Route_Planner](https://shroffr01.github.io/Route_Planner/)**

Driving-route weather forecasts, with a per-location favorability grade (A–F) at every stop —
plus live radar and official NWS/SPC/WPC hazard overlays on the map.

[![Deploy web to GitHub Pages](https://github.com/shroffr01/Route_Planner/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/shroffr01/Route_Planner/actions/workflows/deploy-pages.yml)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

See [`implementation.md`](./implementation.md) for the full design and rationale.

## What it does

Enter an origin, a destination, and a departure time. Route Planner calls out to Mapbox for
the driving route, samples the weather at every hour of travel along it, and grades each stop
A–F for how favorable conditions are — so you can see at a glance whether you're driving into
a storm three hours from now, not just whether it's raining at your front door.

- **Clickable waypoint markers** at every hour of travel — temp, condition, UV, cloud %, wind
  gust, precipitation chance, visibility.
- **NWS weather alerts** per waypoint, surfaced in the popover and drawn as polygons on the map.
- **A–F favorability grade** on every marker, in every popover, in the trip summary, and as a
  colored band under the timeline.
- **Live HRRR radar overlay** with a scrubber to preview reflectivity at any point along the trip.
- **SPC / WPC hazard overlays** — convective outlook, excessive rainfall outlook, Day 3–7 hazards.
- **Shareable trip summary** — copy or native-share a text recap of the route, grades, and alerts.
- Light/dark theme, mobile bottom-sheet layout, animated intro and step-by-step loading states.

## Stack

- **Backend:** FastAPI + httpx + Redis + Shapely, Python 3.12 via [pixi](https://pixi.sh).
- **Frontend:** Next.js 15 + React 19 + TypeScript + Tailwind + Mapbox GL JS + TanStack Query + Zustand + Recharts.
- **Map provider:** Mapbox (locked — see implementation.md §2).

## Deployment

The frontend and backend deploy independently:

| | Where | How |
|---|---|---|
| **Frontend** (`apps/web`) | [GitHub Pages](https://shroffr01.github.io/Route_Planner/) | Static export (`next build`, `output: "export"`). [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml) builds and publishes on every push to `main` that touches `apps/web/**`. |
| **Backend** (`apps/api`) | [Fly.io](https://fly.io) | Dockerized FastAPI app (`apps/api/Dockerfile`, `apps/api/fly.toml`), deployed with `flyctl deploy` from `apps/api/`. |

The frontend talks to the backend over plain HTTP via `NEXT_PUBLIC_API_BASE_URL`, baked in at
build time as a GitHub Actions repo variable. The backend's `CORS_ORIGINS` Fly secret allow-lists
the Pages origin.

Redeploying the backend after a code change:

```bash
cd apps/api
flyctl deploy
```

## Repository layout

```
Route_Planner/
├─ implementation.md              ← Design doc (source of truth)
├─ pixi.toml                      ← Backend deps + tasks
├─ docker-compose.yml             ← api + redis + web
├─ apps/
│  ├─ api/                        ← FastAPI backend (deployed to Fly.io)
│  └─ web/                        ← Next.js frontend (deployed to GitHub Pages)
└─ .env.example                   ← Copy to .env and fill in keys
```

## Prerequisites

- **pixi** for the backend (already installed in this repo: `pixi --version`).
- **Node.js 20+** for the frontend.
- **A Mapbox public token** (`pk....`) — get one from <https://account.mapbox.com>.
- **An OpenWeather One Call 3.0 API key** — get one from <https://openweathermap.org/api/one-call-3>.
- (Optional) **Redis** for caching. Without it, the API falls back to an in-process
  LRU+TTL cache (`app/services/memcache.py`), so it still runs standalone.

## Local setup

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
│  ├─ config.py           ← Settings (pydantic-settings, .env / Fly secrets)
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
├─ Dockerfile             ← Production image (deployed to Fly.io)
├─ fly.toml               ← Fly.io app config
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

## What's still TODO

These are scoped for follow-up iterations:

- **CSV / JSON / PDF export.** Backend has the data; the download buttons aren't wired up yet.
- **"Best departure window" mode** — call `/trip` with several candidate departures and grade each.
- **Shareable URL state** — encode form values in the querystring (`nuqs`).
- **Multi-stop routing** — the backend accepts up to 10 waypoints; the form only exposes start + end.
- **Frontend tests** — Vitest + Playwright not yet wired.
- **Backend CI** — tests/lint run locally via pixi; not yet wired into a GitHub Actions workflow.
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

**GitHub Pages deploy fails on `npm ci`** — the lockfile is out of sync with
`package.json`; run `npm install` in `apps/web/` and commit the updated
`package-lock.json`.

## Contact

shroff.rohan01@gmail.com

## License

See [LICENSE](./LICENSE). All rights reserved — the source is public for viewing,
not for reuse.
