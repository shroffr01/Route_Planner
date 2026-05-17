"use client";
import { AlertCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { OverlayMenu } from "@/components/map/OverlayMenu";
import { RadarScrubber } from "@/components/map/RadarScrubber";
import { TripForm, type TripFormValue } from "@/components/planner/TripForm";
import { TripSummary } from "@/components/planner/TripSummary";
import { Timeline } from "@/components/planner/Timeline";
import { useTripMutation } from "@/hooks/useTrip";
import type { TripResponse } from "@/lib/schemas";

const MapView = dynamic(() => import("@/components/map/Map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
      Loading map…
    </div>
  ),
});

export default function PlanPage() {
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutation = useTripMutation();

  async function onSubmit(v: TripFormValue) {
    setError(null);
    if (!v.origin || !v.destination) return;
    try {
      const res = await mutation.mutateAsync({
        waypoints: [
          { label: v.origin.label, lat: v.origin.lat, lon: v.origin.lon },
          { label: v.destination.label, lat: v.destination.lat, lon: v.destination.lon },
        ],
        depart_at: v.departAt.toISOString(),
        options: {
          avoid_tolls: v.avoidTolls,
          avoid_highways: v.avoidHighways,
        },
      });
      setTrip(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      setTrip(null);
    }
  }

  return (
    <div className="mx-auto grid max-w-screen-2xl grid-cols-1 gap-6 px-4 py-6 md:px-6 lg:grid-cols-[400px_1fr] lg:py-8">
      <aside className="space-y-5">
        <TripForm onSubmit={onSubmit} loading={mutation.isPending} />
        {error && (
          <div className="card fade-up flex gap-3 border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">We couldn&apos;t plan that trip.</div>
              <div className="mt-0.5 text-xs opacity-80">{error}</div>
            </div>
          </div>
        )}
        {trip && <TripSummary trip={trip} />}
      </aside>
      <section className="space-y-5">
        <div className="card fade-up h-[540px] overflow-hidden p-0">
          <MapView trip={trip} />
        </div>
        {trip && <RadarScrubber trip={trip} />}
        <OverlayMenu />
        {trip ? (
          <Timeline trip={trip} />
        ) : (
          <EmptyHint />
        )}
      </section>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="card fade-up flex items-center gap-4 p-6 text-sm text-zinc-600 dark:text-zinc-400">
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgb(var(--accent-from)), rgb(var(--accent-to)))",
        }}
      >
        ✦
      </span>
      <div>
        <div className="font-medium text-zinc-900 dark:text-zinc-100">
          Plan a trip to see the forecast
        </div>
        <div className="mt-0.5 text-xs">
          Pick two cities and a departure time. We&apos;ll sample your route every hour.
        </div>
      </div>
    </div>
  );
}
