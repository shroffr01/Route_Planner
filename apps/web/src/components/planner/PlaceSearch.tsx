"use client";
import { MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { searchPlacesDirect } from "@/lib/mapbox";
import type { Place } from "@/lib/schemas";

export function PlaceSearch({
  label,
  value,
  onChange,
  placeholder = "City, address, or place",
}: {
  label: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState(value?.label ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQ(value?.label ?? "");
  }, [value]);

  // 100ms debounce. Stale responses are dropped via a request-id counter
  // rather than AbortController — aborting an in-flight fetch raises an
  // "AbortError: signal is aborted without reason" that surfaces in Next's
  // dev error overlay even when caught, so we just ignore late results.
  function onInputChange(text: string) {
    setQ(text);
    setOpen(true);
    if (value) onChange(null);

    if (timerRef.current) clearTimeout(timerRef.current);
    const requestId = ++requestIdRef.current;

    if (!text.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(() => {
      searchPlacesDirect(text)
        .then((r) => {
          if (requestIdRef.current === requestId) {
            setResults(r);
            setLoading(false);
          }
        })
        .catch(() => {
          if (requestIdRef.current === requestId) {
            setResults([]);
            setLoading(false);
          }
        });
    }, 100);
  }

  function pick(p: Place) {
    onChange(p);
    setQ(p.label);
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </label>
      <div className="group relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="text"
          value={q}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-9 pr-3 text-sm shadow-sm outline-none transition-all placeholder:text-zinc-400 hover:border-zinc-300 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:focus:border-sky-500 dark:focus:ring-sky-950"
        />
      </div>

      {open && q.trim().length > 0 && (loading || results.length > 0) && (
        <ul className="absolute z-50 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-xl ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-white/5">
          {loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-zinc-500">Searching…</li>
          )}
          {results.map((p, i) => (
            <li
              key={`${p.lat}-${p.lon}-${i}`}
              role="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              className="flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <MapPin size={14} className="mt-0.5 shrink-0 text-zinc-400" />
              <span className="truncate">{p.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
