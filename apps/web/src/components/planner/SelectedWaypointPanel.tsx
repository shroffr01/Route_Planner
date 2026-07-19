"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { renderWaypointPopupHTML } from "@/components/map/popupContent";
import type { TripResponse } from "@/lib/schemas";
import { useUiStore } from "@/store/ui";

export function SelectedWaypointPanel({ trip }: { trip: TripResponse }) {
  const selected = useUiStore((s) => s.selectedWaypoint);
  const setSelectedWaypoint = useUiStore((s) => s.setSelectedWaypoint);
  const index = selected ?? 0;
  const waypoint = trip.waypoints[index];

  if (!waypoint) return null;

  const canPrev = index > 0;
  const canNext = index < trip.waypoints.length - 1;

  return (
    <>
      <div className="card fade-up flex items-center justify-between gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={() => canPrev && setSelectedWaypoint(index - 1)}
          disabled={!canPrev}
          aria-label="Previous stop"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Stop {index + 1} of {trip.waypoints.length}
        </div>
        <button
          type="button"
          onClick={() => canNext && setSelectedWaypoint(index + 1)}
          disabled={!canNext}
          aria-label="Next stop"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div
        className="card fade-up overflow-hidden"
        dangerouslySetInnerHTML={{ __html: renderWaypointPopupHTML(trip, index) }}
      />
    </>
  );
}
