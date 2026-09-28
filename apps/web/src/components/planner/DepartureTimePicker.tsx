"use client";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const MAX_ADVANCE_DAYS = 7;

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
  // `min`/`max` depend on "now", which differs between the server render and
  // the client render at hydration time. Don't compute them during render —
  // start with no bounds (identical on server and client) and fill them in
  // after mount, so the server- and client-rendered HTML always match.
  const [bounds, setBounds] = useState<{ min: Date; max: Date } | null>(null);

  useEffect(() => {
    const min = new Date();
    const max = new Date(min.getTime() + MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1000);
    setBounds({ min, max });
  }, []);

  function handleChange(next: Date) {
    if (Number.isNaN(next.getTime())) return;
    if (bounds && next < bounds.min) {
      onChange(bounds.min);
    } else if (bounds && next > bounds.max) {
      onChange(bounds.max);
    } else {
      onChange(next);
    }
  }

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
            min={bounds ? toLocalInputValue(bounds.min) : undefined}
            max={bounds ? toLocalInputValue(bounds.max) : undefined}
            onChange={(e) => handleChange(new Date(e.target.value))}
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
