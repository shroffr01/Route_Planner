"use client";
import { Pause, Play, Radio } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { HRRR_MAX_FORECAST_MIN } from "@/lib/hrrr";
import { departTimeMs, positionAtTime, tripDurationMin } from "@/lib/route";
import type { TripResponse } from "@/lib/schemas";
import { useUiStore } from "@/store/ui";

const STEP_MIN = 60; // scrub resolution — HRRR native cadence
const PLAYBACK_TICK_MS = 900;
const PLAYBACK_STEP_MIN = 60;

export function RadarScrubber({ trip }: { trip: TripResponse }) {
  const enabled = useUiStore((s) => s.radarEnabled);
  const setEnabled = useUiStore((s) => s.setRadarEnabled);
  const offset = useUiStore((s) => s.radarOffsetMin);
  const setOffset = useUiStore((s) => s.setRadarOffsetMin);
  const [playing, setPlaying] = useState(false);

  const totalMin = tripDurationMin(trip);
  const t0 = departTimeMs(trip);
  // HRRR has no data past 48h from now, regardless of how far out the trip's
  // depart time is — if the whole trip starts beyond that, there's nothing to show.
  const unavailable = t0 - Date.now() > HRRR_MAX_FORECAST_MIN * 60_000;
  const targetMs = t0 + offset * 60_000;
  const [lon, lat] = positionAtTime(trip, targetMs);

  const targetLabel = new Date(targetMs).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  // Auto-play loops the scrubber. Useful as a "preview my drive" affordance.
  const tickRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing || !enabled) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = window.setInterval(() => {
      const next = offset + PLAYBACK_STEP_MIN;
      setOffset(next > totalMin ? 0 : next);
    }, PLAYBACK_TICK_MS);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [playing, enabled, offset, totalMin, setOffset]);

  // Reset when the trip changes (so a new trip doesn't start mid-route).
  const tripKey = trip.waypoints[0]?.arrival ?? "";
  useEffect(() => {
    setOffset(0);
    setPlaying(false);
  }, [tripKey, setOffset]);

  // No HRRR data exists this far out — force the toggle off rather than
  // leaving it "on" with nothing to render.
  useEffect(() => {
    if (unavailable && enabled) {
      setEnabled(false);
      setPlaying(false);
    }
  }, [unavailable, enabled, setEnabled]);

  return (
    <div className="card fade-up p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, rgb(var(--accent-from)), rgb(var(--accent-to)))",
            }}
          >
            <Radio size={14} />
          </span>
          <div>
            <div className="text-sm font-semibold tracking-tight">Forecast radar</div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              HRRR composite reflectivity, up to 48 h ahead. Scrub to preview your drive.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            disabled={!enabled || unavailable}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            title={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <label
            className={`inline-flex items-center gap-2 text-xs ${unavailable ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
            title={unavailable ? "HRRR radar only forecasts 48 h ahead" : undefined}
          >
            <span className="text-zinc-500 dark:text-zinc-400">Radar</span>
            <span className="relative inline-block h-5 w-9">
              <input
                type="checkbox"
                checked={enabled}
                disabled={unavailable}
                onChange={(e) => setEnabled(e.target.checked)}
                className="peer h-0 w-0 opacity-0"
              />
              <span className="absolute inset-0 cursor-pointer rounded-full bg-zinc-300 transition peer-checked:bg-sky-500 dark:bg-zinc-700" />
              <span className="absolute left-0.5 top-0.5 h-4 w-4 cursor-pointer rounded-full bg-white shadow transition peer-checked:translate-x-4" />
            </span>
          </label>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={totalMin}
        step={STEP_MIN}
        value={Math.min(offset, totalMin)}
        onChange={(e) => setOffset(Number(e.target.value))}
        className="w-full accent-sky-500 disabled:opacity-50"
        disabled={!enabled || unavailable}
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>Departure</span>
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {unavailable ? (
            <span className="text-zinc-400">Radar unavailable — departs more than 48h from now</span>
          ) : enabled ? (
            <>
              +{formatOffset(offset)} → {targetLabel}
              <span className="ml-2 text-zinc-400">
                ({lat.toFixed(2)}°, {lon.toFixed(2)}°)
              </span>
            </>
          ) : (
            <span className="text-zinc-400">Toggle on to preview</span>
          )}
        </span>
        <span>+{formatOffset(totalMin)}</span>
      </div>
    </div>
  );
}

function formatOffset(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
