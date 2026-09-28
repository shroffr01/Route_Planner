"use client";
import { ArrowRight, GripVertical, Loader2, Plus, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import type { Place } from "@/lib/schemas";

import { DepartureTimePicker } from "./DepartureTimePicker";
import { PlaceSearch } from "./PlaceSearch";

export type TripFormValue = {
  origin: Place | null;
  stops: Place[];
  destination: Place | null;
  departAt: Date;
  avoidTolls: boolean;
  avoidHighways: boolean;
};

const MAX_STOPS = 4;

// `new Date()` returns a different value on the server (SSR render time)
// than on the client (hydration time), which would make the departure
// input's rendered value mismatch between the two and trigger a hydration
// error. Start from a fixed, deterministic placeholder instead and swap in
// the real "now" once mounted on the client.
const UNSET_DEPART_AT = new Date(0);

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
  const [stops, setStops] = useState<(Place | null)[]>(initial?.stops ?? []);
  const [destination, setDestination] = useState<Place | null>(initial?.destination ?? null);
  const [departAt, setDepartAt] = useState<Date>(initial?.departAt ?? UNSET_DEPART_AT);
  const [avoidTolls, setAvoidTolls] = useState(initial?.avoidTolls ?? false);
  const [avoidHighways, setAvoidHighways] = useState(initial?.avoidHighways ?? false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => {
    if (departAt === UNSET_DEPART_AT) setDepartAt(new Date());
    // Only run once on mount to resolve the placeholder — intentionally
    // excludes `departAt` so later user edits aren't overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit = origin && destination && !loading;

  function addStop() {
    if (stops.length < MAX_STOPS) setStops([...stops, null]);
  }

  function removeStop(i: number) {
    setStops((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateStop(i: number, p: Place | null) {
    setStops((prev) => prev.map((s, idx) => (idx === i ? p : s)));
  }

  function handleDragStart(i: number, e: React.DragEvent) {
    setDragFrom(i);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(i: number, e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(i);
  }

  function handleDrop(i: number, e: React.DragEvent) {
    e.preventDefault();
    if (dragFrom !== null && dragFrom !== i) {
      setStops((prev) => {
        const next = [...prev];
        const [item] = next.splice(dragFrom, 1);
        next.splice(i, 0, item);
        return next;
      });
    }
    setDragFrom(null);
    setDragOver(null);
  }

  function handleDragEnd() {
    setDragFrom(null);
    setDragOver(null);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({
          origin,
          stops: stops.filter((s): s is Place => s !== null),
          destination,
          departAt,
          avoidTolls,
          avoidHighways,
        });
      }}
      className="card fade-up relative z-20"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Plan your trip
        </h2>
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          title="Route settings"
          className={cn(
            "-mr-1 rounded-lg p-1.5 transition-colors",
            settingsOpen
              ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300",
          )}
        >
          <Settings size={15} />
        </button>
      </div>

      {/* Main inputs — compact single flex-wrap row (original layout) */}
      <div className="flex flex-wrap items-end gap-3 px-5 py-4">
        <div className="min-w-[180px] flex-1 basis-48">
          <PlaceSearch label="From" value={origin} onChange={setOrigin} placeholder="Start location" />
        </div>
        <div className="min-w-[180px] flex-1 basis-48">
          <PlaceSearch label="To" value={destination} onChange={setDestination} placeholder="Destination" />
        </div>
        <div className="min-w-[220px] flex-1 basis-56">
          <DepartureTimePicker value={departAt} onChange={setDepartAt} />
        </div>

        {/* + Via button — inline with main inputs, no extra height when no stops */}
        {stops.length < MAX_STOPS && (
          <button
            type="button"
            onClick={addStop}
            title="Add an intermediate stop"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-zinc-300 px-3.5 py-[11px] text-sm font-medium text-zinc-500 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-blue-400 dark:hover:text-blue-400"
          >
            <Plus size={14} />
            Via
          </button>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-primary shrink-0 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all"
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Planning…</>
          ) : (
            <>Plan trip <ArrowRight size={16} /></>
          )}
        </button>
      </div>

      {/* Intermediate stops — expands below when Via is clicked */}
      {stops.length > 0 && (
        <div className="border-t border-zinc-100 px-5 pb-4 pt-3 dark:border-zinc-800">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
            Via
          </div>
          <div className="flex flex-wrap gap-3">
            {stops.map((stop, i) => (
              <div
                key={i}
                draggable
                onDragStart={(e) => handleDragStart(i, e)}
                onDragOver={(e) => handleDragOver(i, e)}
                onDrop={(e) => handleDrop(i, e)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex min-w-[200px] flex-1 basis-52 items-end gap-1.5 rounded-xl transition-all",
                  dragOver === i && dragFrom !== i ? "ring-2 ring-blue-400 ring-offset-1" : "",
                  dragFrom === i ? "opacity-40" : "",
                )}
              >
                <GripVertical
                  size={14}
                  className="mb-[13px] shrink-0 cursor-grab touch-none select-none text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400"
                />
                <div className="min-w-0 flex-1">
                  <PlaceSearch
                    label={`Stop ${i + 1}`}
                    value={stop}
                    onChange={(p) => updateStop(i, p)}
                    placeholder="Intermediate stop"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeStop(i)}
                  aria-label={`Remove stop ${i + 1}`}
                  className="mb-[10px] flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Route settings */}
      {settingsOpen && (
        <div className="rounded-b-[10px] border-t border-zinc-100 bg-zinc-50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-800/40">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Route options
          </p>
          <div className="flex flex-wrap gap-x-6">
            <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={avoidTolls}
                onChange={(e) => setAvoidTolls(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 accent-blue-600 dark:border-zinc-600"
              />
              Avoid tolls
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={avoidHighways}
                onChange={(e) => setAvoidHighways(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 accent-blue-600 dark:border-zinc-600"
              />
              Avoid highways
            </label>
          </div>
        </div>
      )}
    </form>
  );
}
