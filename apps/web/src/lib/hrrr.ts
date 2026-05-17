// HRRR (High-Resolution Rapid Refresh) composite reflectivity tiles.
//
// Source: Iowa State Univ. IEM TMS — free, no key required.
//   https://mesonet.agron.iastate.edu/ogc/
// Endpoint pattern (TMS, NOT WMS):
//   https://mesonet.agron.iastate.edu/c/tile.py/1.0.0/{layer}/{z}/{x}/{y}.png
// Layers (composite reflectivity):
//   hrrr::REFD-FFFFF-0          ← latest run, FFFFF = forecast MINUTE (0..2880)
//   hrrr::REFD-FFFFF-YYYYMMDDHHMI  ← archived, specific run init
// HRRR runs hourly. Extended runs (00/06/12/18 UTC) reach +48h; standard runs
// only reach +18h. Using "-0" delegates run-selection to IEM, which always
// serves the most recent run that has the requested forecast minute.
//
// Two cache variants:
//   /c/tile.py/...      → 14-day cache header (good for archive)
//   /cache/tile.py/...  → 5-minute cache header (good for live forecasts)
// We use /cache/ so the latest forecast picks up new runs quickly.
//
// IMPORTANT: this is a TMS endpoint, so the y-axis is flipped vs XYZ.
// Mapbox raster sources default to xyz; we set scheme: "tms" on the source.

const TMS_BASE = "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0";
export const HRRR_MAX_FORECAST_MIN = 2880; // 48 h
const HRRR_STEP_MIN = 60; // HRRR resolution is hourly

export type HrrrPick = {
  // Tile URL with {z}/{x}/{y} placeholders for Mapbox.
  tileUrl: string;
  // Resolved forecast minute (multiple of 60, in [0, 2880]).
  forecastMin: number;
  clamped: "before" | "after" | null;
};

export function pickHrrrFrame(targetMs: number, now = Date.now()): HrrrPick {
  // IEM's "-0" suffix means "latest run", so the forecast minute is offset
  // from "now" — not from a specific model init time we control.
  const rawMin = Math.round((targetMs - now) / 60_000);
  let clamped: HrrrPick["clamped"] = null;
  let snapped = Math.round(rawMin / HRRR_STEP_MIN) * HRRR_STEP_MIN;
  if (snapped < 0) {
    snapped = 0;
    clamped = "before";
  } else if (snapped > HRRR_MAX_FORECAST_MIN) {
    snapped = HRRR_MAX_FORECAST_MIN;
    clamped = "after";
  }
  // Layer name format is "hrrr::REFD-FXXXX-0" — the literal F is part of the
  // layer name, not a placeholder. Without it the server returns 404.
  const fStr = "F" + snapped.toString().padStart(4, "0");
  // Mapbox substitutes {z}/{x}/{y} per tile.
  const tileUrl = `${TMS_BASE}/hrrr::REFD-${fStr}-0/{z}/{x}/{y}.png`;
  return { tileUrl, forecastMin: snapped, clamped };
}

export function formatForecastHour(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `+${h}h` : `+${h}h ${m}m`;
}
