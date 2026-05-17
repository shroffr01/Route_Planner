import { CloudSun, MapPin, Sparkles, Zap } from "lucide-react";
import Link from "next/link";

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-screen-xl px-6 pb-20 pt-16 sm:pt-24 md:pb-28">
          <div className="fade-up mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300">
              <Sparkles size={12} /> Hourly forecasts along your full route
            </span>
            <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tightest sm:text-6xl md:text-7xl">
              Drive into <span className="text-gradient">clear skies.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
              See the weather at every stop of your drive, graded A through F
              so you can spot trouble before you leave the driveway.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/plan"
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-semibold transition-all"
              >
                Plan a trip
                <span aria-hidden>→</span>
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/70 px-6 py-3 text-sm font-medium text-zinc-700 backdrop-blur transition-colors hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                How it works
              </a>
            </div>
          </div>

          {/* Decorative preview */}
          <div className="fade-up mx-auto mt-16 max-w-4xl" style={{ animationDelay: "120ms" }}>
            <div className="card p-1.5">
              <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-gradient-to-br from-sky-50 via-white to-indigo-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-indigo-950/30">
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex flex-wrap items-center justify-center gap-3 px-6">
                    {(["A", "A", "B", "C", "B", "A"] as const).map((g, i) => (
                      <PreviewPill key={i} grade={g} />
                    ))}
                  </div>
                </div>
                <svg
                  className="absolute inset-x-0 bottom-0 text-sky-400/30 dark:text-sky-500/20"
                  viewBox="0 0 800 200"
                  fill="none"
                  preserveAspectRatio="none"
                  style={{ width: "100%", height: "55%" }}
                >
                  <path
                    d="M0,140 C120,100 200,160 320,120 C440,80 520,160 640,110 C720,80 770,90 800,80 L800,200 L0,200 Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section id="how-it-works" className="mx-auto max-w-screen-xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={<MapPin size={20} />}
            title="Every hour of your drive"
            body="We sample your route by travel time and forecast the weather at each point — when you'll actually be there."
          />
          <FeatureCard
            icon={<CloudSun size={20} />}
            title="A–F favorability grade"
            body="Wind, rain, ice, visibility, and active alerts roll up into one letter you can read in a glance."
          />
          <FeatureCard
            icon={<Zap size={20} />}
            title="Instant and shareable"
            body="Cached forecasts return in milliseconds. Share a trip link with anyone — no account needed."
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-6 transition-transform hover:-translate-y-0.5">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
    </div>
  );
}

function PreviewPill({ grade }: { grade: "A" | "B" | "C" | "D" | "F" }) {
  const bg = {
    A: "bg-grade-a",
    B: "bg-grade-b text-zinc-900",
    C: "bg-grade-c text-zinc-900",
    D: "bg-grade-d",
    F: "bg-grade-f",
  }[grade];
  return (
    <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-md dark:bg-zinc-900">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${bg}`}
      >
        {grade}
      </span>
      <span className="text-xs font-medium">72°F</span>
    </div>
  );
}
