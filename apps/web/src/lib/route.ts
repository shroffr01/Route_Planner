import type { TripResponse } from "@/lib/schemas";

export type LonLat = [number, number];

// Linear interpolation between waypoint arrival times to estimate where the
// driver will be at `targetMs`. Waypoints are spaced ~1 hour apart along the
// actual polyline (sample_waypoints in router.py samples by travel duration),
// so linear interpolation between adjacent waypoints stays close to the route.
export function positionAtTime(trip: TripResponse, targetMs: number): LonLat {
  const wps = trip.waypoints;
  if (wps.length === 0) return [0, 0];
  const first = new Date(wps[0].arrival).getTime();
  const last = new Date(wps[wps.length - 1].arrival).getTime();
  if (targetMs <= first) return [wps[0].lon, wps[0].lat];
  if (targetMs >= last) return [wps[wps.length - 1].lon, wps[wps.length - 1].lat];
  for (let i = 0; i < wps.length - 1; i++) {
    const a = new Date(wps[i].arrival).getTime();
    const b = new Date(wps[i + 1].arrival).getTime();
    if (targetMs >= a && targetMs <= b) {
      const t = b === a ? 0 : (targetMs - a) / (b - a);
      const lon = wps[i].lon + t * (wps[i + 1].lon - wps[i].lon);
      const lat = wps[i].lat + t * (wps[i + 1].lat - wps[i].lat);
      return [lon, lat];
    }
  }
  return [wps[wps.length - 1].lon, wps[wps.length - 1].lat];
}

export function departTimeMs(trip: TripResponse): number {
  return trip.waypoints.length > 0 ? new Date(trip.waypoints[0].arrival).getTime() : Date.now();
}

export function tripDurationMin(trip: TripResponse): number {
  return Math.max(1, Math.round(trip.route.duration_s / 60));
}
