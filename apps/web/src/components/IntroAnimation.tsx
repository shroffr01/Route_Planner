"use client";
import { useCallback, useEffect, useState } from "react";

export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);

  const dismiss = useCallback(() => {
    setFading(true);
    setTimeout(onDone, 600);
  }, [onDone]);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 3000);
    const t2 = setTimeout(onDone, 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed", inset: 0, zIndex: 9999, cursor: "pointer",
        background: "linear-gradient(170deg, #04080f 0%, #071224 45%, #0a1a08 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        transition: "opacity 0.6s cubic-bezier(0.4,0,0.2,1)",
        opacity: fading ? 0 : 1, pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* Starfield + shooting star */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice"
      >
        {Array.from({ length: 80 }, (_, i) => {
          const x = (i * 139.7 + 17) % 1000;
          const y = (i * 97.3 + 11) % 380;
          const r = 0.4 + (i % 4) * 0.35;
          const dur = 1.4 + (i % 7) * 0.3;
          const delay = (i * 0.17) % 2.5;
          return (
            <circle
              key={i} cx={x} cy={y} r={r} fill="white"
              style={{ animation: `intro-star ${dur}s ${delay}s ease-in-out infinite` }}
            />
          );
        })}
        {/* Shooting star */}
        <g style={{ animation: "intro-shooting-star 5s 0.9s ease-out infinite" }}>
          <line x1={130} y1={55} x2={165} y2={72} stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} strokeLinecap="round" />
          <line x1={130} y1={55} x2={150} y2={64} stroke="rgba(255,255,255,0.3)" strokeWidth={4} strokeLinecap="round" style={{ filter: "blur(1.5px)" }} />
        </g>
      </svg>

      {/* Scene */}
      <svg
        viewBox="0 0 800 320"
        style={{ width: "min(92vw, 820px)", maxHeight: "52vh", overflow: "visible" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="rp-sky" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#120830" />
            <stop offset="45%" stopColor="#0b1535" />
            <stop offset="100%" stopColor="#081e2e" />
          </linearGradient>
          <linearGradient id="rp-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d1a08" />
            <stop offset="100%" stopColor="#040d03" />
          </linearGradient>
          <linearGradient id="rp-road" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e1e1e" />
            <stop offset="100%" stopColor="#111" />
          </linearGradient>
          <radialGradient id="rp-moon-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,248,200,0.22)" />
            <stop offset="55%" stopColor="rgba(255,248,200,0.07)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="rp-storm-glow" cx="50%" cy="80%" r="60%">
            <stop offset="0%" stopColor="rgba(80,90,180,0.3)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="rp-headlight-beam" cx="0%" cy="50%" r="100%">
            <stop offset="0%" stopColor="rgba(255,245,160,0.55)" />
            <stop offset="100%" stopColor="rgba(255,245,160,0)" />
          </radialGradient>
          <filter id="rp-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="rp-glow-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id="rp-clip"><rect width="800" height="320" /></clipPath>
        </defs>

        <g clipPath="url(#rp-clip)">
          {/* Sky */}
          <rect width="800" height="230" fill="url(#rp-sky)" />

          {/* Storm glow on left */}
          <ellipse cx="200" cy="200" rx="180" ry="120" fill="url(#rp-storm-glow)" />

          {/* Moon glow halos */}
          <circle cx="700" cy="62" r="72" fill="url(#rp-moon-glow)" />
          <circle cx="700" cy="62" r="30" fill="rgba(255,248,200,0.06)" style={{ filter: "blur(4px)" }} />
          {/* Moon ring */}
          <circle cx="700" cy="62" r="25" fill="none" stroke="rgba(255,248,200,0.18)" strokeWidth="4" style={{ filter: "blur(3px)" }} />
          {/* Moon disc */}
          <circle cx="700" cy="62" r="19" fill="#e9e2cb" />
          {/* Moon craters */}
          <circle cx="692" cy="57" r="3.5" fill="rgba(160,150,120,0.45)" />
          <circle cx="706" cy="69" r="2.5" fill="rgba(160,150,120,0.35)" />
          <circle cx="695" cy="71" r="1.8" fill="rgba(160,150,120,0.28)" />
          <circle cx="708" cy="57" r="1.4" fill="rgba(160,150,120,0.22)" />

          {/* Far mountains */}
          <polygon
            points="0,225 50,155 110,185 180,105 250,160 330,130 400,170 460,125 530,155 600,110 660,145 720,105 780,140 800,130 800,225"
            fill="#0a0d1a"
          />
          {/* Near mountains */}
          <polygon
            points="0,225 70,175 140,210 200,155 280,195 350,165 420,220 480,175 560,215 620,170 700,205 760,175 800,190 800,225"
            fill="#0d1120"
          />

          {/* Atmospheric horizon haze */}
          <rect x="0" y="208" width="800" height="26" fill="rgba(12,22,48,0.6)" style={{ filter: "blur(12px)" }} />

          {/* Ground */}
          <rect y="225" width="800" height="95" fill="url(#rp-ground)" />

          {/* Road (perspective trapezoid) */}
          <polygon points="210,258 590,258 690,320 110,320" fill="url(#rp-road)" />

          {/* Road edge lines */}
          <line x1="210" y1="258" x2="110" y2="320" stroke="#262626" strokeWidth="1.5" />
          <line x1="590" y1="258" x2="690" y2="320" stroke="#262626" strokeWidth="1.5" />

          {/* Road surface sheen */}
          <polygon points="210,258 590,258 690,320 110,320" fill="rgba(40,60,100,0.08)" />

          {/* Faint route glow line */}
          <line x1="110" y1="293" x2="690" y2="293" stroke="rgba(14,165,233,0.22)" strokeWidth="2" style={{ filter: "blur(1.5px)" }} />

          {/* Animated road center dashes — scroll toward viewer */}
          <path
            d="M 400 261 L 400 318"
            stroke="rgba(90,90,90,0.75)"
            strokeWidth="2.5"
            fill="none"
            strokeDasharray="8 16"
            style={{ animation: "intro-road-scroll 0.6s linear infinite" }}
          />

          {/* Storm cloud group */}
          <g style={{ animation: "intro-cloud-sway 3.5s ease-in-out infinite" }}>
            {/* Ground shadow */}
            <ellipse cx="210" cy="240" rx="110" ry="10" fill="rgba(0,0,20,0.45)" style={{ filter: "blur(8px)" }} />
            {/* Cloud puffs */}
            <ellipse cx="160" cy="150" rx="65" ry="42" fill="#141424" />
            <ellipse cx="215" cy="132" rx="78" ry="52" fill="#161628" />
            <ellipse cx="280" cy="148" rx="58" ry="38" fill="#131322" />
            <ellipse cx="215" cy="168" rx="88" ry="28" fill="#101020" />
            {/* Rain */}
            {[188, 205, 220, 235, 250, 170, 197, 240].map((x, i) => (
              <line
                key={i}
                x1={x} y1={190 + (i % 4) * 4}
                x2={x - 6} y2={215 + (i % 4) * 4}
                stroke="rgba(120,160,255,0.45)" strokeWidth="1.5"
                style={{ animation: `intro-rain ${0.55 + (i % 4) * 0.12}s ${(i * 0.09) % 0.45}s linear infinite` }}
              />
            ))}
            {/* Lightning bolt (glow layer + bright core) */}
            <polyline
              points="228,138 214,163 222,163 206,192"
              stroke="#90c0ff" strokeWidth="4" fill="none" strokeLinejoin="round"
              style={{ animation: "intro-lightning 2.8s 0.6s ease-in-out infinite", filter: "url(#rp-glow-soft)" }}
            />
            <polyline
              points="228,138 214,163 222,163 206,192"
              stroke="#d8eeff" strokeWidth="2" fill="none" strokeLinejoin="round"
              style={{ animation: "intro-lightning 2.8s 0.6s ease-in-out infinite", filter: "url(#rp-glow)" }}
            />
            <polyline
              points="228,138 214,163 222,163 206,192"
              stroke="white" strokeWidth="1" fill="none" strokeLinejoin="round"
              style={{ animation: "intro-lightning 2.8s 0.6s ease-in-out infinite" }}
            />
          </g>

          {/* Fair-weather cloud (right) */}
          <g opacity="0.45">
            <ellipse cx="620" cy="78" rx="32" ry="16" fill="#1e2e42" />
            <ellipse cx="648" cy="68" rx="28" ry="18" fill="#1e2e42" />
            <ellipse cx="674" cy="76" rx="24" ry="13" fill="#1e2e42" />
          </g>

          {/* Car — animated left→right */}
          <g style={{ animation: "intro-drive 3.4s 0.15s linear both" }}>
            {/* Speed streaks behind car */}
            <line x1={312} y1={279} x2={272} y2={279} stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1={312} y1={285} x2={265} y2={285} stroke="rgba(255,255,255,0.13)" strokeWidth="1" strokeLinecap="round" />
            <line x1={312} y1={291} x2={274} y2={291} stroke="rgba(255,255,255,0.10)" strokeWidth="0.8" strokeLinecap="round" />
            <line x1={312} y1={296} x2={270} y2={296} stroke="rgba(255,255,255,0.13)" strokeWidth="1" strokeLinecap="round" />

            {/* Headlight outer soft glow */}
            <ellipse cx="424" cy="284" rx="44" ry="20" fill="rgba(255,240,120,0.07)" style={{ filter: "blur(10px)" }} />
            {/* Headlight beam cone */}
            <polygon
              points="382,284 452,265 452,303 382,297"
              fill="url(#rp-headlight-beam)"
              style={{ animation: "intro-headlight-pulse 1.6s ease-in-out infinite" }}
            />

            {/* Wheels — rendered before body so body covers the top half */}
            {[342, 364].map((cx) => (
              <g
                key={cx}
                style={{
                  animation: "intro-wheel-spin 0.32s linear infinite",
                  transformBox: "fill-box",
                  transformOrigin: "center",
                } as React.CSSProperties}
              >
                <circle cx={cx} cy={302} r={8} fill="#161616" />
                <circle cx={cx} cy={302} r={4.5} fill="#2e2e2e" />
                <line x1={cx - 7} y1={302} x2={cx + 7} y2={302} stroke="#4a4a4a" strokeWidth="1.5" />
                <line x1={cx} y1={295} x2={cx} y2={309} stroke="#4a4a4a" strokeWidth="1.5" />
              </g>
            ))}

            {/* Body */}
            <rect x="322" y="282" width="62" height="20" rx="4" fill="#ddeeff" />
            {/* Roof */}
            <rect x="332" y="270" width="44" height="14" rx="6" fill="#cce0f5" />
            {/* Windows */}
            <rect x="336" y="272" width="15" height="10" rx="2" fill="rgba(80,160,220,0.72)" />
            <rect x="355" y="272" width="15" height="10" rx="2" fill="rgba(80,160,220,0.72)" />
            {/* Headlight */}
            <rect x="381" y="287" width="5" height="6" rx="1.5" fill="#ffe88a" style={{ filter: "url(#rp-glow)" }} />
            {/* Taillight */}
            <rect x="319" y="287" width="4" height="6" rx="1.5" fill="#ff4040" style={{ filter: "url(#rp-glow)" }} />
          </g>
        </g>
      </svg>

      {/* Text */}
      <div
        style={{
          marginTop: "2.25rem",
          color: "rgba(255,255,255,0.92)",
          fontSize: "clamp(1rem, 2.5vw, 1.3rem)",
          fontWeight: 600,
          letterSpacing: "0.04em",
          fontFamily: "var(--font-inter, sans-serif)",
          display: "flex", alignItems: "center", gap: "0",
        }}
      >
        <span
          style={{
            display: "inline-block",
            animation: "intro-text-fade 0.6s 0.4s ease both, intro-shimmer 2.8s 1.2s linear infinite",
            backgroundImage:
              "linear-gradient(90deg, rgba(160,210,255,0.85) 0%, rgba(255,255,255,1) 35%, rgba(180,230,255,0.95) 65%, rgba(160,210,255,0.85) 100%)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Planning the smartest route
        </span>
        <span aria-hidden style={{ display: "inline-flex", width: "1.4em" }}>
          <span style={{ animation: "intro-dot 1.2s 0s step-end infinite" }}>.</span>
          <span style={{ animation: "intro-dot 1.2s 0.4s step-end infinite" }}>.</span>
          <span style={{ animation: "intro-dot 1.2s 0.8s step-end infinite" }}>.</span>
        </span>
      </div>

      <div
        style={{
          marginTop: "0.6rem",
          color: "rgba(255,255,255,0.3)",
          fontSize: "0.72rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontFamily: "var(--font-inter, sans-serif)",
          animation: "intro-text-fade 0.6s 0.7s ease both",
          opacity: 0,
        }}
      >
        Click anywhere to skip
      </div>
    </div>
  );
}
