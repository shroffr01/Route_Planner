"use client";
import { Clock } from "lucide-react";

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DepartureTimePicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Departure
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Clock
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="datetime-local"
            value={toLocalInputValue(value)}
            onChange={(e) => onChange(new Date(e.target.value))}
            className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-9 pr-3 text-sm shadow-sm outline-none transition-all hover:border-zinc-300 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:focus:border-sky-500 dark:focus:ring-sky-950"
          />
        </div>
        <button
          type="button"
          onClick={() => onChange(new Date())}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Now
        </button>
      </div>
    </div>
  );
}
