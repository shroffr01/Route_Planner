export function formatHour(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDuration(s: number): string {
  const hours = Math.floor(s / 3600);
  const mins = Math.round((s % 3600) / 60);
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function formatMiles(meters: number): string {
  const mi = meters / 1609.344;
  return `${mi.toFixed(0)} mi`;
}

export function gradeColorVar(letter: "A" | "B" | "C" | "D" | "F"): string {
  return `var(--grade-${letter.toLowerCase()})`;
}

export function gradeBgClass(letter: "A" | "B" | "C" | "D" | "F"): string {
  return {
    A: "bg-grade-a text-white",
    B: "bg-grade-b text-zinc-900",
    C: "bg-grade-c text-zinc-900",
    D: "bg-grade-d text-white",
    F: "bg-grade-f text-white",
  }[letter];
}
