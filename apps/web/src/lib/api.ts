import { GeocodeResultsSchema, TripResponseSchema, type TripResponse } from "./schemas";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export type WaypointInput = { label?: string; lat?: number; lon?: number };

export async function searchPlaces(q: string, proximity?: [number, number]) {
  const params = new URLSearchParams({ q });
  if (proximity) params.set("proximity", `${proximity[0]},${proximity[1]}`);
  const r = await fetch(`${API_BASE}/api/v1/geocode?${params.toString()}`);
  if (!r.ok) throw new Error(`Geocode failed: ${r.status}`);
  return GeocodeResultsSchema.parse(await r.json()).results;
}

export async function planTrip(args: {
  waypoints: WaypointInput[];
  depart_at: string; // ISO
  options?: { avoid_tolls?: boolean; avoid_highways?: boolean };
}): Promise<TripResponse> {
  const r = await fetch(`${API_BASE}/api/v1/trip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`Trip failed (${r.status}): ${detail}`);
  }
  return TripResponseSchema.parse(await r.json());
}
