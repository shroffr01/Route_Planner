"use client";
import { useMutation } from "@tanstack/react-query";

import { planTrip, type WaypointInput } from "@/lib/api";

export function useTripMutation() {
  return useMutation({
    mutationFn: (input: {
      waypoints: WaypointInput[];
      depart_at: string;
      options?: { avoid_tolls?: boolean; avoid_highways?: boolean };
    }) => planTrip(input),
  });
}
