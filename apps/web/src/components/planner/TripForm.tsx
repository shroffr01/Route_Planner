"use client";
import { ArrowRight, Loader2, Settings } from "lucide-react";
import { useState } from "react";

import type { Place } from "@/lib/schemas";

import { DepartureTimePicker } from "./DepartureTimePicker";
import { PlaceSearch } from "./PlaceSearch";

export type TripFormValue = {
  origin: Place | null;
  destination: Place | null;
  departAt: Date;
  avoidTolls: boolean;
  avoidHighways: boolean;
};

export function TripForm({
  initial,
  onSubmit,
  loading,
}: {
  initial?: TripFormValue;
  onSubmit: (v: TripFormValue) => void;
  loading?: boolean;
}) {
  const [origin, setOrigin] = useState<Place | null>(initial?.origin ?? null);
  const [destination, setDestination] = useState<Place | null>(initial?.destination ?? null);
  const [departAt, setDepartAt] = useState<Date>(initial?.departAt ?? new Date());
  const [avoidTolls, setAvoidTolls] = useState(initial?.avoidTolls ?? false);
  const [avoidHighways, setAvoidHighways] = useState(initial?.avoidHighways ?? false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const canSubmit = origin && destination && !loading;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({ origin, destination, departAt, avoidTolls, avoidHighways });
      }}
      className="card fade-up p-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Plan your trip</h2>
          <p className="mb-5 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Pick two stops and a departure time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          title="Route settings"
          className={`mt-0.5 rounded-lg p-1.5 transition-colors ${
            settingsOpen
              ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          <Settings size={16} />
        </button>
      </div>

      {settingsOpen && (
        <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/60">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Route options
          </p>
          <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={avoidTolls}
              onChange={(e) => setAvoidTolls(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-sky-500 dark:border-zinc-600"
            />
            Avoid tolls
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={avoidHighways}
              onChange={(e) => setAvoidHighways(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-sky-500 dark:border-zinc-600"
            />
            Avoid highways
          </label>
        </div>
      )}

      <div className="space-y-4">
        <PlaceSearch label="From" value={origin} onChange={setOrigin} placeholder="Start location" />
        <PlaceSearch label="To" value={destination} onChange={setDestination} placeholder="Destination" />
        <DepartureTimePicker value={departAt} onChange={setDepartAt} />
      </div>
      <button
        type="submit"
        disabled={!canSubmit}
        className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Planning…
          </>
        ) : (
          <>
            Plan trip <ArrowRight size={16} />
          </>
        )}
      </button>
    </form>
  );
}
