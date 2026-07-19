"use client";
import { Check, Copy, Share2, X } from "lucide-react";
import { useState } from "react";

import { formatDuration, formatHour, formatMiles } from "@/lib/format";
import type { TripResponse } from "@/lib/schemas";

function buildShareText(trip: TripResponse): string {
  const first = trip.waypoints[0];
  const last = trip.waypoints[trip.waypoints.length - 1];
  const origin = trip.origin.label.split(",")[0];
  const dest = trip.destination.label.split(",")[0];

  // Sample up to 5 representative waypoints evenly
  const total = trip.waypoints.length;
  const step = Math.max(1, Math.floor(total / 5));
  const sampled = Array.from({ length: Math.min(5, total) }, (_, i) =>
    trip.waypoints[Math.min(i * step, total - 1)],
  );

  const lines = [
    `🗺  ${origin} → ${dest}`,
    `📊 Trip grade: ${trip.trip_grade.letter}`,
    `📏 ${formatMiles(trip.route.distance_m)} · ${formatDuration(trip.route.duration_s)}`,
    first ? `⏰ Depart ${formatHour(first.arrival)}` : null,
    last ? `🏁 Arrive ${formatHour(last.arrival)}` : null,
    trip.alerts.length > 0
      ? `⚠️  ${trip.alerts.length} active weather alert${trip.alerts.length === 1 ? "" : "s"}`
      : "✅ No active alerts on this route",
    "",
    "Stops:",
    ...sampled.map((w) =>
      `  ${w.grade.letter}  ${w.place_label}${w.forecast ? `  ${Math.round(w.forecast.temp_f)}°F` : ""}`,
    ),
    "",
    "Planned with RoutePlanner",
  ];

  return lines.filter((l) => l !== null).join("\n");
}

export function ShareModal({
  trip,
  onClose,
}: {
  trip: TripResponse;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = buildShareText(trip);
  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — user can select the textarea manually
    }
  }

  async function share() {
    if (canNativeShare) {
      try {
        await navigator.share({
          title: `${trip.origin.label.split(",")[0]} → ${trip.destination.label.split(",")[0]}`,
          text,
        });
      } catch {
        /* user dismissed */
      }
    } else {
      copy();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Share this trip
          </span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <textarea
            readOnly
            value={text}
            rows={10}
            className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          />
          <div className="flex gap-2.5">
            <button
              onClick={copy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {copied ? (
                <Check size={15} className="text-emerald-500" />
              ) : (
                <Copy size={15} />
              )}
              {copied ? "Copied!" : "Copy text"}
            </button>
            {canNativeShare && (
              <button
                onClick={share}
                className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
              >
                <Share2 size={15} /> Share
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
