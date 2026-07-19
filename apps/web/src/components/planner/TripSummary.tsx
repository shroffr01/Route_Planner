"use client";
import { AlertTriangle, Clock4, Route as RouteIcon, Share2 } from "lucide-react";

import { formatDuration, formatHour, formatMiles } from "@/lib/format";
import type { TripResponse } from "@/lib/schemas";

import { GradeBadge } from "./GradeBadge";

export function TripSummary({
  trip,
  onShare,
}: {
  trip: TripResponse;
  onShare?: () => void;
}) {
  const first = trip.waypoints[0];
  const last = trip.waypoints[trip.waypoints.length - 1];

  return (
    <div className="card fade-up overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Your trip
        </div>
        <div className="flex items-center gap-2">
          {onShare && (
            <button
              onClick={onShare}
              title="Share this trip"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <Share2 size={14} />
            </button>
          )}
          <GradeBadge grade={trip.trip_grade} size="md" showReasons />
        </div>
      </div>
      <div className="flex gap-3 px-5 pt-3 pb-4">
        <div className="flex flex-col items-center">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              background: "rgb(var(--accent-from))",
              boxShadow: "0 0 0 4px rgb(var(--accent-from) / 0.15)",
            }}
          />
          <span className="my-1 w-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              background: "rgb(var(--accent-to))",
              boxShadow: "0 0 0 4px rgb(var(--accent-to) / 0.15)",
            }}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {trip.origin.label.split(",")[0]}
            </div>
            {first && (
              <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Departs {formatHour(first.arrival)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {trip.destination.label.split(",")[0]}
            </div>
            {last && (
              <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Arrives {formatHour(last.arrival)}
              </div>
            )}
          </div>
        </div>
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
    <div className="px-5 py-3.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-0.5 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
