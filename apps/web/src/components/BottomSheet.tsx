"use client";
import { ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function BottomSheet({
  children,
  open,
  peekLabel,
}: {
  children: React.ReactNode;
  open: boolean;
  peekLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) setExpanded(true);
    else setExpanded(false);
  }, [open]);

  const translate = !open
    ? "translate-y-full"
    : expanded
    ? "translate-y-0"
    : "translate-y-[calc(100%-3rem)]";

  return (
    <>
      {expanded && open && (
        <div
          className="fixed inset-0 z-20 bg-black/25 backdrop-blur-[2px] lg:hidden"
          onClick={() => setExpanded(false)}
        />
      )}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 transition-transform duration-300 ease-out lg:hidden ${translate}`}
      >
        {/* Handle bar */}
        <div
          role="button"
          aria-label={expanded ? "Collapse trip details" : "Expand trip details"}
          className="flex cursor-pointer items-center gap-3 rounded-t-2xl border border-b-0 border-zinc-200 bg-white/95 px-5 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95"
          onClick={() => setExpanded((v) => !v)}
          onTouchStart={(e) => { startYRef.current = e.touches[0].clientY; }}
          onTouchEnd={(e) => {
            if (startYRef.current === null) return;
            const delta = e.changedTouches[0].clientY - startYRef.current;
            if (delta > 50) setExpanded(false);
            else if (delta < -50) setExpanded(true);
            startYRef.current = null;
          }}
        >
          <div className="h-1 w-10 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <span
            className={`flex-1 truncate text-sm font-medium text-zinc-700 transition-opacity dark:text-zinc-200 ${
              expanded ? "opacity-0" : "opacity-100"
            }`}
          >
            {peekLabel ?? ""}
          </span>
          <ChevronUp
            size={16}
            className={`shrink-0 text-zinc-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </div>

        {/* Scrollable content */}
        <div className="max-h-[68vh] overflow-y-auto border border-t-0 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="space-y-4 p-4 pb-10">{children}</div>
        </div>
      </div>
    </>
  );
}
