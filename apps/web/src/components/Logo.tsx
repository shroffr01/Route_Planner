export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl text-white"
      style={{
        width: size,
        height: size,
        backgroundImage:
          "linear-gradient(135deg, rgb(var(--accent-from)), rgb(var(--accent-to)))",
        boxShadow: "0 6px 16px -8px rgba(56,189,248,0.7)",
      }}
      aria-hidden
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <path
          d="M5 18c0-3 2-5 5-5s5-2 5-5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="5" cy="18" r="2" fill="currentColor" />
        <circle cx="19" cy="6" r="2.4" fill="currentColor" />
      </svg>
    </span>
  );
}
