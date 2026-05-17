"use client";
import { useUiStore } from "@/store/ui";

type Day = { id: string; label: string };
type Group = { id: string; label: string; color: string; days?: Day[] };

const GROUPS: Group[] = [
  {
    id: "spc",
    label: "SPC Outlook",
    color: "#ef4444",
    days: [
      { id: "spc-day1", label: "Day 1" },
      { id: "spc-day2", label: "Day 2" },
      { id: "spc-day3", label: "Day 3" },
    ],
  },
  {
    id: "ero",
    label: "Excessive Rainfall",
    color: "#3b82f6",
    days: [
      { id: "wpc-ero-day1", label: "Day 1" },
      { id: "wpc-ero-day2", label: "Day 2" },
    ],
  },
  {
    id: "wpc-hazards",
    label: "WPC Hazards",
    color: "#f97316",
  },
];

export function OverlayMenu() {
  const activeOverlay = useUiStore((s) => s.activeOverlay);
  const setActiveOverlay = useUiStore((s) => s.setActiveOverlay);

  function isGroupActive(group: Group): boolean {
    if (!group.days) return activeOverlay === group.id;
    return group.days.some((d) => d.id === activeOverlay);
  }

  function handleGroupClick(group: Group) {
    if (isGroupActive(group)) {
      setActiveOverlay(null);
    } else if (group.days) {
      setActiveOverlay(group.days[0].id);
    } else {
      setActiveOverlay(group.id);
    }
  }

  const anyActive = GROUPS.some((g) => isGroupActive(g));
  const activeDays = GROUPS.find((g) => isGroupActive(g) && g.days)?.days;

  return (
    <div className="card fade-up p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Map Overlays
        </p>
        {anyActive && (
          <button
            type="button"
            onClick={() => setActiveOverlay(null)}
            className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Clear
          </button>
        )}
      </div>

      {/* Main group buttons — always one row */}
      <div className="flex gap-2">
        {GROUPS.map((group) => {
          const active = isGroupActive(group);
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => handleGroupClick(group)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? "border-sky-400/60 bg-sky-50 text-sky-800 dark:border-sky-600/60 dark:bg-sky-950/40 dark:text-sky-200"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: group.color, opacity: active ? 1 : 0.35 }}
              />
              {group.label}
            </button>
          );
        })}
      </div>

      {/* Day picker — appears below when a group with days is active */}
      {activeDays && (
        <div className="mt-2 flex gap-1.5">
          <span className="flex items-center text-[11px] text-zinc-400 dark:text-zinc-500">
            Day:
          </span>
          {activeDays.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => setActiveOverlay(day.id)}
              className={`rounded-md border px-3 py-0.5 text-[11px] font-semibold transition-colors ${
                activeOverlay === day.id
                  ? "border-sky-500 bg-sky-500 text-white"
                  : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
