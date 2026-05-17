import { z } from "zod";

export const RouteOptionsSchema = z.object({
  avoid_tolls: z.boolean().default(false),
  avoid_highways: z.boolean().default(false),
});
export type RouteOptions = z.infer<typeof RouteOptionsSchema>;

export const AlternativeRouteSchema = z.object({
  polyline_geojson: z.unknown(),
  distance_m: z.number(),
  duration_s: z.number(),
});
export type AlternativeRoute = z.infer<typeof AlternativeRouteSchema>;

export const ForecastSchema = z.object({
  temp_f: z.number(),
  feels_like_f: z.number(),
  dew_point_f: z.number().nullable().optional(),
  humidity_pct: z.number().nullable().optional(),
  pop_pct: z.number(),
  wind_mph: z.number(),
  wind_gust_mph: z.number().nullable().optional(),
  visibility_mi: z.number().nullable().optional(),
  cloud_pct: z.number(),
  uv: z.number().nullable().optional(),
  condition_code: z.string(),
  summary: z.string(),
});

export const GradeSchema = z.object({
  letter: z.enum(["A", "B", "C", "D", "F"]),
  score: z.number(),
  reasons: z.array(z.string()),
});

export const AlertSchema = z.object({
  event: z.string(),
  headline: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  severity: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  polygon_geojson: z.unknown().nullable().optional(),
  intersects_waypoints: z.array(z.number()).default([]),
});

export const WaypointOutSchema = z.object({
  index: z.number(),
  lat: z.number(),
  lon: z.number(),
  arrival: z.string(),
  place_label: z.string(),
  forecast: ForecastSchema.nullable().optional(),
  grade: GradeSchema,
  active_alerts: z.array(z.number()).default([]),
});

export const TripResponseSchema = z.object({
  route: z.object({
    distance_m: z.number(),
    duration_s: z.number(),
    polyline_geojson: z.unknown(),
    bounding_box: z.array(z.number()),
  }),
  waypoints: z.array(WaypointOutSchema),
  alerts: z.array(AlertSchema),
  trip_grade: GradeSchema,
  origin: z.object({ label: z.string(), lat: z.number(), lon: z.number() }),
  destination: z.object({ label: z.string(), lat: z.number(), lon: z.number() }),
  alternative_routes: z.array(AlternativeRouteSchema).default([]),
});

export type Forecast = z.infer<typeof ForecastSchema>;
export type Grade = z.infer<typeof GradeSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type WaypointOut = z.infer<typeof WaypointOutSchema>;
export type TripResponse = z.infer<typeof TripResponseSchema>;

export const PlaceSchema = z.object({
  label: z.string(),
  lat: z.number(),
  lon: z.number(),
});
export type Place = z.infer<typeof PlaceSchema>;

export const GeocodeResultsSchema = z.object({
  results: z.array(PlaceSchema),
});
