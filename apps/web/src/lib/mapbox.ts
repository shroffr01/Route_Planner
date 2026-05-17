import type { Place } from "./schemas";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// Routes can only be planned within the contiguous US (lower 48). Mapbox
// `country=us` would still include Alaska, Hawaii, and US territories — the
// bbox restricts further to the CONUS rectangle. The defensive client filter
// below catches any boundary cases Mapbox lets through.
const LOWER_48_BBOX: [number, number, number, number] = [-125, 24, -66.93, 49.38];

function inLower48(lat: number, lon: number): boolean {
  return (
    lon >= LOWER_48_BBOX[0] &&
    lat >= LOWER_48_BBOX[1] &&
    lon <= LOWER_48_BBOX[2] &&
    lat <= LOWER_48_BBOX[3]
  );
}

// In-memory cache so retyping the same query is instant.
const cache = new Map<string, { at: number; results: Place[] }>();
const TTL_MS = 5 * 60 * 1000;

export async function searchPlacesDirect(
  query: string,
  opts: { signal?: AbortSignal; limit?: number } = {},
): Promise<Place[]> {
  const q = query.trim();
  if (!q || !MAPBOX_TOKEN) return [];

  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.results;

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`,
  );
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("limit", String(opts.limit ?? 5));
  url.searchParams.set("types", "address,place,locality,region,postcode,poi");
  url.searchParams.set("country", "us");
  url.searchParams.set("bbox", LOWER_48_BBOX.join(","));

  const r = await fetch(url.toString(), { signal: opts.signal });
  if (!r.ok) return [];
  const data = (await r.json()) as {
    features: Array<{ place_name: string; center: [number, number] }>;
  };
  const results: Place[] = data.features
    .map((f) => ({
      label: f.place_name,
      lat: f.center[1],
      lon: f.center[0],
    }))
    .filter((p) => inLower48(p.lat, p.lon));
  cache.set(key, { at: Date.now(), results });
  return results;
}
