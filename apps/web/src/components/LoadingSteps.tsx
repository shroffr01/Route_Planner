"use client";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const STEPS = [
  { label: "Finding your locations", ms: 0 },
  { label: "Calculating the route", ms: 900 },
  { label: "Fetching hourly forecasts", ms: 2400 },
  { label: "Grading stops A–F", ms: 4200 },
] as const;

export function LoadingSteps({ loading }: { loading: boolean }) {
  const [step, setStep] = useState(-1);

  useEffect(() => {
    if (!loading) { setStep(-1); return; }
    setStep(0);
    const timers = STEPS.slice(1).map((s, i) => setTimeout(() => setStep(i + 1), s.ms));
    return () => timers.forEach(clearTimeout);
  }, [loading]);

  if (!loading || step < 0) return null;

  return (
    <div className="card fade-up overflow-hidden">
      <div className="px-5 py-4">
        <div className="mb-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Planning your route
        </div>
        <div className="space-y-3">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div
                key={i}
                className={`flex items-center gap-3 text-sm transition-opacity duration-300 ${
                  i > step ? "opacity-30" : "opacity-100"
                }`}
              >
                {done ? (
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
                ) : active ? (
                  <Loader2 size={15} className="shrink-0 animate-spin text-sky-500" />
                ) : (
                  <Circle size={15} className="shrink-0 text-zinc-300 dark:text-zinc-600" />
                )}
                <span
                  className={
                    done
                      ? "text-zinc-400 line-through dark:text-zinc-600"
                      : active
                      ? "font-medium text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-500 dark:text-zinc-400"
                  }
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="h-1 w-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-700 ease-out"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
