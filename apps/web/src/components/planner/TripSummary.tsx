"use client";
import { AlertTriangle, Clock4, Route as RouteIcon } from "lucide-react";

import { formatDuration, formatMiles } from "@/lib/format";
import type { TripResponse } from "@/lib/schemas";

import { GradeBadge } from "./GradeBadge";

export function TripSummary({ trip }: { trip: TripResponse }) {
  return (
    <div className="card fade-up overflow-hidden">
      <div className="flex items-start justify-between gap-4 p-6 pb-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Your trip
          </div>
          <div className="mt-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
            {trip.origin.label.split(",")[0]} → {trip.destination.label.split(",")[0]}
          </div>
        </div>
        <GradeBadge grade={trip.trip_grade} size="lg" showReasons />
      </div>
      <div className="grid grid-cols-2 divide-x divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        <Stat
          icon={<Clock4 size={14} />}
          label="Duration"
          value={formatDuration(trip.route.duration_s)}
        />
        <Stat
          icon={<RouteIcon size={14} />}
          label="Distance"
          value={formatMiles(trip.route.distance_m)}
        />
      </div>
      {trip.alerts.length > 0 && (
        <div className="border-t border-rose-200 bg-rose-50/60 px-6 py-4 dark:border-rose-950 dark:bg-rose-950/20">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
            <AlertTriangle size={14} />
            {trip.alerts.length} active alert{trip.alerts.length === 1 ? "" : "s"} on your route
          </div>
          <ul className="space-y-1 text-xs text-rose-800 dark:text-rose-200">
            {trip.alerts.slice(0, 4).map((a, i) => (
              <li key={i} className="truncate">
                • {a.event}
                {a.headline ? <span className="opacity-70"> — {a.headline}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-0.5 text-lg font-semibold tracking-tight">{value}</div>
    </div>
  );
}
