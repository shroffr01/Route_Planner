import { formatHour } from "@/lib/format";
import type { Alert, TripResponse } from "@/lib/schemas";

// NWS severity → polygon fill color. Lower-severity alerts stay visible but
// don't shout as loudly as Extreme/Severe ones.
export const SEVERITY_FILL: Record<string, string> = {
  Extreme: "#dc2626", // red-600
  Severe: "#ef4444", // red-500
  Moderate: "#f97316", // orange-500
  Minor: "#eab308", // yellow-500
  Unknown: "#a1a1aa", // zinc-400
};
export const SEVERITY_LINE: Record<string, string> = {
  Extreme: "#991b1b",
  Severe: "#b91c1c",
  Moderate: "#c2410c",
  Minor: "#a16207",
  Unknown: "#52525b",
};

// ---- Weather icon set (OpenWeatherMap icon codes -> inline SVG) ----
// Minimal stroke-based glyphs, color-coded by condition (sun = amber, cloud =
// grey, rain = blue, etc.) so the marker/popup reads at a glance regardless of theme.
const ICON_BASE =
  'viewBox="0 0 24 24" width="18" height="18" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

const SUN_COLOR = "#f59e0b"; // amber-500
const MOON_COLOR = "#94a3b8"; // slate-400
const CLOUD_COLOR = "#9ca3af"; // gray-400
const STORM_CLOUD_COLOR = "#71717a"; // zinc-500
const RAIN_COLOR = "#3b82f6"; // blue-500
const SNOW_COLOR = "#7dd3fc"; // sky-300
const BOLT_COLOR = "#eab308"; // yellow-500
const MIST_COLOR = "#a1a1aa"; // zinc-400
const NO_DATA_COLOR = "#a1a1aa"; // zinc-400

const SUN_ICON = `<svg ${ICON_BASE} stroke="${SUN_COLOR}">
  <circle cx="12" cy="12" r="4.2"/>
  <line x1="12" y1="2.5" x2="12" y2="4.8"/>
  <line x1="12" y1="19.2" x2="12" y2="21.5"/>
  <line x1="2.5" y1="12" x2="4.8" y2="12"/>
  <line x1="19.2" y1="12" x2="21.5" y2="12"/>
  <line x1="5" y1="5" x2="6.6" y2="6.6"/>
  <line x1="17.4" y1="17.4" x2="19" y2="19"/>
  <line x1="5" y1="19" x2="6.6" y2="17.4"/>
  <line x1="17.4" y1="6.6" x2="19" y2="5"/>
</svg>`;

const MOON_ICON = `<svg ${ICON_BASE} stroke="${MOON_COLOR}">
  <path d="M19 14.2A7.5 7.5 0 1 1 9.8 5a6 6 0 0 0 9.2 9.2Z"/>
</svg>`;

const PARTLY_CLOUDY_DAY_ICON = `<svg ${ICON_BASE} stroke="${CLOUD_COLOR}">
  <g stroke="${SUN_COLOR}">
    <circle cx="8.5" cy="7.5" r="2.6"/>
    <line x1="8.5" y1="2.8" x2="8.5" y2="4"/>
    <line x1="3.8" y1="7.5" x2="5" y2="7.5"/>
    <line x1="5.1" y1="4.1" x2="5.9" y2="4.9"/>
  </g>
  <path d="M6.3 18a3.8 3.8 0 0 1 .4-7.6 5.3 5.3 0 0 1 10.1 1.7A3.6 3.6 0 0 1 16.5 18H6.3Z"/>
</svg>`;

const PARTLY_CLOUDY_NIGHT_ICON = `<svg ${ICON_BASE} stroke="${CLOUD_COLOR}">
  <path d="M10.6 8.4A3.6 3.6 0 0 1 8.3 4.7a3.8 3.8 0 1 0 4 5.9 3.6 3.6 0 0 1-1.7-2.2Z" stroke="${MOON_COLOR}"/>
  <path d="M6.3 18a3.8 3.8 0 0 1 .4-7.6 5.3 5.3 0 0 1 10.1 1.7A3.6 3.6 0 0 1 16.5 18H6.3Z"/>
</svg>`;

const CLOUDY_ICON = `<svg ${ICON_BASE} stroke="${CLOUD_COLOR}">
  <path d="M6 17a4 4 0 0 1 .4-7.97A5.4 5.4 0 0 1 16.7 8.8 3.8 3.8 0 0 1 16.5 17H6Z"/>
</svg>`;

const RAIN_ICON = `<svg ${ICON_BASE} stroke="${CLOUD_COLOR}">
  <path d="M6 14a3.6 3.6 0 0 1 .4-7.16A5 5 0 0 1 16 6.2 3.6 3.6 0 0 1 15.6 14H6Z"/>
  <g stroke="${RAIN_COLOR}">
    <line x1="8" y1="17.5" x2="7" y2="21"/>
    <line x1="12" y1="17.5" x2="11" y2="21"/>
    <line x1="16" y1="17.5" x2="15" y2="21"/>
  </g>
</svg>`;

const THUNDERSTORM_ICON = `<svg ${ICON_BASE} stroke="${STORM_CLOUD_COLOR}">
  <path d="M6 13a3.6 3.6 0 0 1 .4-7.16A5 5 0 0 1 16 5.2 3.6 3.6 0 0 1 15.6 13H6Z"/>
  <path d="M12.6 14.5 10 19h3l-2 4.3" stroke="${BOLT_COLOR}" fill="${BOLT_COLOR}" fill-opacity="0.18"/>
</svg>`;

const SNOW_ICON = `<svg ${ICON_BASE} stroke="${CLOUD_COLOR}">
  <path d="M6 13a3.6 3.6 0 0 1 .4-7.16A5 5 0 0 1 16 5.2 3.6 3.6 0 0 1 15.6 13H6Z"/>
  <g stroke="${SNOW_COLOR}">
    <line x1="8" y1="17.5" x2="8" y2="21.5"/>
    <line x1="6.5" y1="19.5" x2="9.5" y2="19.5"/>
    <line x1="15" y1="17.5" x2="15" y2="21.5"/>
    <line x1="13.5" y1="19.5" x2="16.5" y2="19.5"/>
  </g>
</svg>`;

const MIST_ICON = `<svg ${ICON_BASE} stroke="${MIST_COLOR}">
  <line x1="4" y1="7.5" x2="20" y2="7.5"/>
  <line x1="4" y1="11.5" x2="20" y2="11.5"/>
  <line x1="6.5" y1="15.5" x2="17.5" y2="15.5"/>
  <line x1="4" y1="19.5" x2="20" y2="19.5"/>
</svg>`;

const NO_DATA_ICON = `<svg ${ICON_BASE} stroke="${NO_DATA_COLOR}">
  <circle cx="12" cy="12" r="8.5"/>
  <line x1="8.3" y1="12" x2="15.7" y2="12"/>
</svg>`;

// Maps an OpenWeatherMap icon code (e.g. "01d", "10n") to one of the glyphs
// above, using the trailing "d"/"n" suffix to pick the day/night variant.
export function weatherIconSvg(conditionCode: string | null | undefined): string {
  if (!conditionCode) return NO_DATA_ICON;
  const isNight = conditionCode.endsWith("n");
  switch (conditionCode.slice(0, 2)) {
    case "01":
      return isNight ? MOON_ICON : SUN_ICON;
    case "02":
    case "03":
      return isNight ? PARTLY_CLOUDY_NIGHT_ICON : PARTLY_CLOUDY_DAY_ICON;
    case "04":
      return CLOUDY_ICON;
    case "09":
    case "10":
      return RAIN_ICON;
    case "11":
      return THUNDERSTORM_ICON;
    case "13":
      return SNOW_ICON;
    case "50":
      return MIST_ICON;
    default:
      return SUN_ICON;
  }
}

export function worstSeverity(alerts: Alert[]): string | null {
  const order = ["Extreme", "Severe", "Moderate", "Minor", "Unknown"];
  let best: number = order.length;
  for (const a of alerts) {
    const i = order.indexOf(a.severity);
    if (i !== -1 && i < best) best = i;
  }
  return best === order.length ? null : order[best];
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAlertWindow(startsAt: string, endsAt: string): string {
  if (!startsAt && !endsAt) return "";
  const fmt = (s: string) => {
    if (!s) return "?";
    const d = new Date(s);
    if (isNaN(d.getTime())) return "?";
    return d.toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  };
  return `In effect ${fmt(startsAt)} → ${fmt(endsAt)}`;
}

// Marker info card: place/time/grade header, temp + weather icon, conditions
// grid, and grading reasons. Alerts are rendered separately via
// `renderAlertsPanelHTML` so they can appear as their own block.
export function renderWaypointPopupHTML(trip: TripResponse, index: number): string {
  const w = trip.waypoints[index];
  if (!w) return "";
  const fc = w.forecast;
  const reasons =
    w.grade.reasons.length > 0
      ? `<div class="reasons">${w.grade.reasons.map((r) => "• " + escapeHtml(r)).join("<br/>")}</div>`
      : "";

  const stats = fc
    ? `
      <div class="grid">
        <div class="k">Feels like</div><div class="v">${Math.round(fc.feels_like_f)}°F</div>
        <div class="k">Precipitation</div><div class="v">${Math.round(fc.pop_pct)}%</div>
        <div class="k">Wind</div><div class="v">${Math.round(fc.wind_mph)} mph${fc.wind_gust_mph ? " (gust " + Math.round(fc.wind_gust_mph) + ")" : ""}</div>
        <div class="k">Cloud cover</div><div class="v">${Math.round(fc.cloud_pct)}%</div>
        ${fc.visibility_mi != null ? `<div class="k">Visibility</div><div class="v">${fc.visibility_mi.toFixed(1)} mi</div>` : ""}
        ${fc.uv != null ? `<div class="k">UV index</div><div class="v">${fc.uv}</div>` : ""}
      </div>`
    : `<div class="summary" style="margin-top:10px;">Forecast unavailable for this point.</div>`;

  const iconHtml = fc
    ? `<span class="rp-popup-icon" title="${escapeHtml(fc.summary)} · ${Math.round(fc.temp_f)}°F">${weatherIconSvg(fc.condition_code)}</span>`
    : "";

  return `
    <div class="rp-popup">
      <div class="head">
        <div>
          <div class="place">${escapeHtml(w.place_label)}</div>
          <div class="time">Arriving ${escapeHtml(formatHour(w.arrival))}</div>
        </div>
        <span class="grade-big grade-${w.grade.letter.toLowerCase()}">${w.grade.letter}</span>
      </div>
      ${
        fc
          ? `<div class="temp-row"><div class="temp">${Math.round(fc.temp_f)}°F</div>${iconHtml}</div><div class="summary">${escapeHtml(fc.summary)}</div>`
          : ""
      }
      ${stats}
      ${reasons}
    </div>
  `;
}

export function renderAlertBlock(alert: Alert): string {
  const sev = alert.severity || "Unknown";
  const sevClass = `sev-${sev.toLowerCase()}`;
  const timeWindow = formatAlertWindow(alert.starts_at, alert.ends_at);
  const headline = alert.headline ? escapeHtml(alert.headline) : "";
  const desc = alert.description ? escapeHtml(alert.description) : "";
  // Header is the click target; body is hidden until .is-open is toggled by
  // the click handler attached on the containing panel.
  return `
    <div class="rp-alert-block">
      <div class="rp-alert-clickable" role="button" tabindex="0">
        <div class="rp-alert-head">
          <span>${escapeHtml(alert.event)}<span class="rp-alert-chev">▶</span></span>
          <span class="rp-alert-sev ${sevClass}">${escapeHtml(sev)}</span>
        </div>
        ${timeWindow ? `<div class="rp-alert-time">${timeWindow}</div>` : ""}
      </div>
      <div class="rp-alert-body">
        ${headline ? `<div class="rp-alert-headline">${headline}</div>` : ""}
        ${desc ? `<div class="rp-alert-desc">${desc}</div>` : ""}
      </div>
    </div>
  `;
}

// Alerts panel: rendered below the marker popup when the selected waypoint has
// active alerts.
export function renderAlertsPanelHTML(alerts: Alert[]): string {
  if (alerts.length === 0) return "";
  return `
    <div class="rp-popup" style="padding-top:14px;">
      <div class="rp-alert-banner" style="margin-top:0;">⚠ ${alerts.length} active weather alert${alerts.length === 1 ? "" : "s"}</div>
      <div class="rp-alert-hint">Click any alert below for full details.</div>
      ${alerts.map(renderAlertBlock).join("")}
    </div>
  `;
}

export function renderAlertPolygonPopup(props: Record<string, string>): string {
  const sev = props.severity || "Unknown";
  const sevClass = `sev-${sev.toLowerCase()}`;
  return `
    <div class="rp-popup" style="padding:14px 16px;">
      <div class="rp-alert-head" style="font-size:14px;">
        <span>${escapeHtml(props.event ?? "Weather alert")}</span>
        <span class="rp-alert-sev ${sevClass}">${escapeHtml(sev)}</span>
      </div>
      ${props.headline ? `<div class="rp-alert-headline">${escapeHtml(props.headline)}</div>` : ""}
    </div>
  `;
}
