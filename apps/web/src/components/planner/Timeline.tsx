"use client";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatHour, gradeBgClass } from "@/lib/format";
import type { TripResponse } from "@/lib/schemas";
import { useUiStore } from "@/store/ui";

export function Timeline({ trip }: { trip: TripResponse }) {
  const setHovered = useUiStore((s) => s.setHoveredWaypoint);
  const hovered = useUiStore((s) => s.hoveredWaypoint);

  const data = trip.waypoints.map((w) => ({
    index: w.index,
    label: formatHour(w.arrival),
    temp: w.forecast ? Math.round(w.forecast.temp_f) : null,
    pop: w.forecast ? Math.round(w.forecast.pop_pct) : 0,
    gust: w.forecast?.wind_gust_mph ? Math.round(w.forecast.wind_gust_mph) : 0,
    grade: w.grade.letter,
  }));

  return (
    <div className="card fade-up p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Hour-by-hour</h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Hover to highlight on the map
        </span>
      </div>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            onMouseMove={(s) => {
              if (s && typeof s.activeTooltipIndex === "number") {
                setHovered(data[s.activeTooltipIndex]?.index ?? null);
              }
            }}
            onMouseLeave={() => setHovered(null)}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
            <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis yAxisId="t" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              yAxisId="p"
              orientation="right"
              fontSize={11}
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(56,189,248,0.08)" }}
              contentStyle={{
                background: "rgb(var(--card))",
                border: "1px solid rgb(var(--border))",
                borderRadius: 10,
                fontSize: 12,
              }}
            />
            <Area
              yAxisId="p"
              type="monotone"
              dataKey="pop"
              stroke="#0ea5e9"
              fill="#0ea5e9"
              fillOpacity={0.18}
              name="Precip %"
            />
            <Bar yAxisId="p" dataKey="gust" fill="#a855f7" name="Gust (mph)" radius={[3, 3, 0, 0]} />
            <Line
              yAxisId="t"
              type="monotone"
              dataKey="temp"
              stroke="#ef4444"
              strokeWidth={2.5}
              dot={false}
              name="Temp (°F)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <span>Trip-long grade</span>
          <span>Hover for detail</span>
        </div>
        <div className="flex gap-1 overflow-hidden rounded-lg">
          {data.map((d, i) => (
            <button
              type="button"
              key={i}
              onMouseEnter={() => setHovered(d.index)}
              onMouseLeave={() => setHovered(null)}
              className={`group flex-1 cursor-pointer py-2 text-center text-xs font-bold transition-all ${gradeBgClass(d.grade as "A" | "B" | "C" | "D" | "F")} ${
                hovered === d.index ? "ring-2 ring-offset-2 ring-sky-400 ring-offset-white dark:ring-offset-zinc-950 scale-y-110" : ""
              }`}
              title={`${d.label} — Grade ${d.grade}`}
            >
              {d.grade}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
