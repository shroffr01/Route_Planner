"use client";
import { useState } from "react";

import { gradeBgClass } from "@/lib/format";
import type { Grade } from "@/lib/schemas";
import { cn } from "@/lib/cn";

export function GradeBadge({
  grade,
  size = "md",
  showReasons = false,
}: {
  grade: Grade;
  size?: "sm" | "md" | "lg";
  showReasons?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sizes = {
    sm: "h-6 w-6 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-14 w-14 text-2xl",
  } as const;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full font-extrabold tracking-tighter shadow-md ring-1 ring-black/5",
          sizes[size],
          gradeBgClass(grade.letter),
        )}
        aria-label={`Weather grade: ${grade.letter}`}
      >
        {grade.letter}
      </span>
      {showReasons && open && grade.reasons.length > 0 && (
        <span className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <strong className="block mb-1.5 text-zinc-700 dark:text-zinc-300">
            Why this grade?
          </strong>
          <ul className="space-y-1 text-zinc-600 dark:text-zinc-400">
            {grade.reasons.map((r, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-zinc-400">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </span>
      )}
    </span>
  );
}
