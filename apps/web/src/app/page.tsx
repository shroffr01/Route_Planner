"use client";
import { AlertCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

import { BottomSheet } from "@/components/BottomSheet";
import { IntroAnimation } from "@/components/IntroAnimation";
import { LoadingSteps } from "@/components/LoadingSteps";
import { ShareModal } from "@/components/ShareModal";
import { OverlayMenu } from "@/components/map/OverlayMenu";
import { RadarScrubber } from "@/components/map/RadarScrubber";
import { SelectedWaypointPanel } from "@/components/planner/SelectedWaypointPanel";
import { TripForm, type TripFormValue } from "@/components/planner/TripForm";
import { TripSummary } from "@/components/planner/TripSummary";
import { useTripMutation } from "@/hooks/useTrip";
import { gradeBgClass } from "@/lib/format";
import type { TripResponse } from "@/lib/schemas";
import { useUiStore } from "@/store/ui";

const MapView = dynamic(() => import("@/components/map/Map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
      Loading map…
    </div>
  ),
});

const Timeline = dynamic(
  () => import("@/components/planner/Timeline").then((m) => m.Timeline),
  {
    ssr: false,
    loading: () => (
      <div className="card fade-up flex h-[280px] items-center justify-center text-sm text-zinc-500">
        Loading timeline…
      </div>
    ),
  },
);

export default function HomePage() {
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const mutation = useTripMutation();
  const setSelectedWaypoint = useUiStore((s) => s.setSelectedWaypoint);

  const handleIntroDone = useCallback(() => setShowIntro(false), []);
  const loading = mutation.isPending;

  async function onSubmit(v: TripFormValue) {
    setError(null);
    if (!v.origin || !v.destination) return;
    try {
      const waypoints = [v.origin, ...v.stops, v.destination].map((p) => ({
        label: p.label,
        lat: p.lat,
        lon: p.lon,
      }));
      const res = await mutation.mutateAsync({
        waypoints,
        depart_at: v.departAt.toISOString(),
        options: { avoid_tolls: v.avoidTolls, avoid_highways: v.avoidHighways },
      });
      setTrip(res);
      setSelectedWaypoint(0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      setTrip(null);
    }
  }

  const sheetLabel = loading
    ? "Planning your route…"
    : trip
    ? `${trip.trip_grade.letter}  ·  ${trip.origin.label.split(",")[0]} → ${trip.destination.label.split(",")[0]}`
    : undefined;

  const sidebarContent = loading ? (
    <LoadingSteps loading={loading} />
  ) : trip ? (
    <>
      <TripSummary trip={trip} onShare={() => setShowShare(true)} />
      <SelectedWaypointPanel trip={trip} />
    </>
  ) : (
    <EmptyHint />
  );

  return (
    <>
      {showIntro && <IntroAnimation onDone={handleIntroDone} />}
      {showShare && trip && <ShareModal trip={trip} onClose={() => setShowShare(false)} />}

      <div className="mx-auto flex max-w-screen-2xl flex-col gap-6 px-4 py-6 md:px-6 lg:py-8">
        <TripForm onSubmit={onSubmit} loading={loading} />

        {error && (
          <div className="card fade-up flex gap-3 border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">We couldn&apos;t plan that trip.</div>
              <div className="mt-0.5 text-xs opacity-80">{error}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          {/* Desktop sidebar — hidden on mobile (bottom sheet handles it) */}
          <aside className="hidden space-y-5 lg:block">{sidebarContent}</aside>

          {/* Map + controls */}
          <div className="flex h-full flex-col gap-6">
            <section className="card flex flex-col min-h-[560px] flex-1 overflow-hidden p-0">
              <MapView trip={trip} />
            </section>
            {trip ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <RadarScrubber trip={trip} />
                <OverlayMenu />
              </div>
            ) : (
              <OverlayMenu />
            )}
          </div>
        </div>

        {trip && <Timeline trip={trip} />}
      </div>

      {/* Mobile bottom sheet */}
      <BottomSheet open={loading || !!trip} peekLabel={sheetLabel}>
        {sidebarContent}
      </BottomSheet>
    </>
  );
}

// ---------------------------------------------------------------------------
// Ghost empty state — shows a preview of what the sidebar looks like
// ---------------------------------------------------------------------------

const GHOST_STOPS = [
  { grade: "A" as const, width: "65%", subWidth: "45%" },
  { grade: "B" as const, width: "72%", subWidth: "52%" },
  { grade: "A" as const, width: "58%", subWidth: "38%" },
  { grade: "C" as const, width: "70%", subWidth: "48%" },
];

function EmptyHint() {
  return (
    <div className="card flex flex-col overflow-hidden" style={{ minHeight: 580 }}>
      {/* Ghost header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
        <div className="h-3 w-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
      </div>

      {/* Ghost route */}
      <div className="flex gap-3 px-5 py-4">
        <div className="flex flex-col items-center">
          <div
            className="h-2.5 w-2.5 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700"
            style={{ boxShadow: "0 0 0 4px rgb(var(--accent-from) / 0.15)" }}
          />
          <div className="my-1 w-px flex-none bg-zinc-100 dark:bg-zinc-800" style={{ height: 28 }} />
          <div
            className="h-2.5 w-2.5 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700"
            style={{ boxShadow: "0 0 0 4px rgb(var(--accent-from) / 0.1)" }}
          />
        </div>
        <div className="flex flex-1 flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="h-4 w-36 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-3 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-28 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-3 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Ghost waypoint list */}
      <div className="flex-1 px-5 py-4">
        <div className="mb-4 h-3 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="space-y-4">
          {GHOST_STOPS.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3"
              style={{ animation: `fade-up 400ms ${80 + i * 70}ms cubic-bezier(0.16,1,0.3,1) both` }}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold opacity-50 ${gradeBgClass(s.grade)}`}
              >
                {s.grade}
              </span>
              <div className="flex-1 space-y-1.5">
                <div
                  className="h-3.5 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800"
                  style={{ width: s.width }}
                />
                <div
                  className="h-2.5 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"
                  style={{ width: s.subWidth }}
                />
              </div>
              <div className="h-3 w-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-zinc-100 px-5 py-5 text-center dark:border-zinc-800">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Plan a trip to see the forecast
        </div>
        <div className="mx-auto mt-1.5 max-w-[240px] text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Enter two cities above — we&apos;ll sample hourly weather along the whole route.
        </div>
      </div>
    </div>
  );
}
