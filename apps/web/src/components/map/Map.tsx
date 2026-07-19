"use client";
import "mapbox-gl/dist/mapbox-gl.css";

import mapboxgl from "mapbox-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTheme } from "@/components/theme/ThemeProvider";
import { pickHrrrFrame } from "@/lib/hrrr";
import {
  escapeHtml,
  renderAlertPolygonPopup,
  renderAlertsPanelHTML,
  SEVERITY_FILL,
  SEVERITY_LINE,
  weatherIconSvg,
  worstSeverity,
} from "@/components/map/popupContent";
import { departTimeMs, positionAtTime } from "@/lib/route";
import type { TripResponse } from "@/lib/schemas";
import { useUiStore } from "@/store/ui";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Minimum on-screen distance (px) between marker anchors before we hide the
// later one — keeps pill labels legible instead of overlapping at low zoom.
// Markers reappear once the camera is close enough to space them out.
const MIN_MARKER_SPACING_PX = 56;

function updateMarkerVisibility(
  map: mapboxgl.Map,
  markers: mapboxgl.Marker[],
  elements: HTMLDivElement[],
): void {
  let lastShown: mapboxgl.Point | null = null;
  markers.forEach((marker, i) => {
    const el = elements[i];
    if (!el) return;
    const point = map.project(marker.getLngLat());
    const show = i === 0 || !lastShown || pointDistance(point, lastShown) >= MIN_MARKER_SPACING_PX;
    el.classList.toggle("rp-marker-hidden", !show);
    if (show) lastShown = point;
  });
}

function pointDistance(a: mapboxgl.Point, b: mapboxgl.Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const ALERT_LAYER_IDS = ["route-alerts-fill", "route-alerts-line"];
// Double-buffered radar: two slots, swap between them so the previous frame
// stays painted until the next frame's tiles have actually loaded.
const RADAR_SOURCES = { a: "radar-tiles-a", b: "radar-tiles-b" } as const;
const RADAR_LAYERS = { a: "radar-tiles-layer-a", b: "radar-tiles-layer-b" } as const;
const RADAR_ALL_SOURCES = [RADAR_SOURCES.a, RADAR_SOURCES.b];
const RADAR_ALL_LAYERS = [RADAR_LAYERS.a, RADAR_LAYERS.b];
const RADAR_OPACITY = 0.75;
const RADAR_FADE_MS = 450;
const GHOST_SOURCE_ID = "ghost-position";
const GHOST_LAYER_ID = "ghost-position-layer";
const GHOST_RING_LAYER_ID = "ghost-position-ring";

type RadarSlot = "a" | "b";
type RadarState = {
  currentSlot: RadarSlot | null;
  currentUrl: string | null;
  pendingSlot: RadarSlot | null;
  pendingUrl: string | null;
  pendingHandler: ((e: mapboxgl.MapSourceDataEvent) => void) | null;
};

export function Map({ trip }: { trip: TripResponse | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const markerElementsRef = useRef<HTMLDivElement[]>([]);
  const activeOverlayIdsRef = useRef<Set<string>>(new Set());
  const { theme } = useTheme();
  const setHovered = useUiStore((s) => s.setHoveredWaypoint);
  const hoveredFromOutside = useUiStore((s) => s.hoveredWaypoint);
  const setSelectedWaypoint = useUiStore((s) => s.setSelectedWaypoint);
  const selectedFromOutside = useUiStore((s) => s.selectedWaypoint);
  const showAlerts = useUiStore((s) => s.showAlerts);
  const setShowAlerts = useUiStore((s) => s.setShowAlerts);
  const radarEnabled = useUiStore((s) => s.radarEnabled);
  const radarOffsetMin = useUiStore((s) => s.radarOffsetMin);
  const activeOverlay = useUiStore((s) => s.activeOverlay);
  const radarStateRef = useRef<RadarState>({
    currentSlot: null,
    currentUrl: null,
    pendingSlot: null,
    pendingUrl: null,
    pendingHandler: null,
  });

  // Bumped every time the Mapbox style finishes loading. setStyle() (theme
  // switch) wipes all sources/layers we added to the previous style, so we use
  // this counter to retrigger the trip + radar effects and re-create them.
  const [styleVersion, setStyleVersion] = useState(0);

  // Recompute only when the selected waypoint or trip changes — NOT on every
  // render (e.g. marker hover). This lets the callback ref below avoid
  // resetting innerHTML (and losing .is-open state) on unrelated re-renders.
  const alertHtml = useMemo(() => {
    const wp =
      trip && selectedFromOutside != null ? trip.waypoints[selectedFromOutside] : null;
    const alerts = wp ? wp.active_alerts.map((j) => trip!.alerts[j]).filter(Boolean) : [];
    return alerts.length > 0 ? renderAlertsPanelHTML(alerts) : "";
  }, [trip, selectedFromOutside]);

  // Only fires when alertHtml changes, so hover re-renders never overwrite the DOM.
  const setAlertPanelEl = useCallback(
    (el: HTMLDivElement | null) => { if (el) el.innerHTML = alertHtml; },
    [alertHtml],
  );

  const styleUrl = useMemo(
    () =>
      theme === "dark"
        ? "mapbox://styles/mapbox/dark-v11"
        : "mapbox://styles/mapbox/streets-v12",
    [theme],
  );

  // Mapbox GL aborts its in-flight tile/style requests when the map is torn
  // down (e.g. React Strict Mode's mount→cleanup→remount cycle in dev). That
  // produces a benign "AbortError: signal is aborted without reason" that
  // Next's dev overlay surfaces as a Runtime Error — swallow just that.
  useEffect(() => {
    const isBenignAbort = (v: unknown) => v instanceof Error && v.name === "AbortError";
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isBenignAbort(e.reason)) e.preventDefault();
    };
    const onError = (e: ErrorEvent) => {
      if (isBenignAbort(e.error)) e.preventDefault();
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [-95, 39],
      zoom: 3.5,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    // setStyle wipes layers — bump styleVersion so the render effects re-run.
    map.on("style.load", () => setStyleVersion((v) => v + 1));
    // Re-declutter markers as the camera moves — zooming in spreads waypoints
    // out on screen, so previously-hidden ones become legible again.
    map.on("move", () => {
      if (mapRef.current) updateMarkerVisibility(mapRef.current, markersRef.current, markerElementsRef.current);
    });
    // Keep canvas pixel-perfect when the container changes size (flex/grid
    // layout settling, window resize, bottom-sheet expansion on mobile).
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update style on theme change. setStyle wipes sources/layers, so reset the
  // radar state — the radar effect will rebuild after style.load fires.
  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      const state = radarStateRef.current;
      if (state.pendingHandler) map.off("sourcedata", state.pendingHandler);
      radarStateRef.current = {
        currentSlot: null,
        currentUrl: null,
        pendingSlot: null,
        pendingUrl: null,
        pendingHandler: null,
      };
      map.setStyle(styleUrl);
    }
  }, [styleUrl]);

  // Highlight the marker that's hovered from the timeline.
  useEffect(() => {
    markerElementsRef.current.forEach((el, i) => {
      if (!el) return;
      const active = hoveredFromOutside === i;
      el.classList.toggle("is-active", active);
    });
  }, [hoveredFromOutside]);

  // Highlight the marker whose info panel is shown in the left column.
  useEffect(() => {
    markerElementsRef.current.forEach((el, i) => {
      if (!el) return;
      el.classList.toggle("is-selected", selectedFromOutside === i);
    });
  }, [selectedFromOutside, trip]);

  // Render route + markers + alerts whenever trip changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !trip) return;

    const apply = () => {
      // Clean existing markers.
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      markerElementsRef.current = [];

      // Clean up any previously rendered alternative route layers/sources.
      for (let i = 0; i < 10; i++) {
        const altLineId = `alt-route-line-${i}`;
        const altSourceId = `alt-route-${i}`;
        if (map.getLayer(altLineId)) map.removeLayer(altLineId);
        if (map.getSource(altSourceId)) map.removeSource(altSourceId);
      }

      // Route line — soft shadow + crisp foreground.
      const lineSourceId = "route-line";
      const lineLayerBg = "route-line-bg";
      const lineLayerFg = "route-line-fg";
      [lineLayerFg, lineLayerBg].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(lineSourceId)) map.removeSource(lineSourceId);
      map.addSource(lineSourceId, {
        type: "geojson",
        data: trip.route.polyline_geojson as GeoJSON.Geometry,
      });
      map.addLayer({
        id: lineLayerBg,
        type: "line",
        source: lineSourceId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#0ea5e9", "line-width": 10, "line-opacity": 0.18 },
      });
      map.addLayer({
        id: lineLayerFg,
        type: "line",
        source: lineSourceId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#0ea5e9", "line-width": 4.5, "line-opacity": 1 },
      });

      // ---- Alternative routes (shown when trip grade is D or F) ----
      if (trip.alternative_routes.length > 0) {
        trip.alternative_routes.forEach((alt, i) => {
          const altSourceId = `alt-route-${i}`;
          const altLineId = `alt-route-line-${i}`;
          if (map.getLayer(altLineId)) map.removeLayer(altLineId);
          if (map.getSource(altSourceId)) map.removeSource(altSourceId);
          map.addSource(altSourceId, {
            type: "geojson",
            data: alt.polyline_geojson as GeoJSON.Geometry,
          });
          map.addLayer(
            {
              id: altLineId,
              type: "line",
              source: altSourceId,
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": "#7dd3fc",
                "line-width": 3,
                "line-opacity": 0.5,
                "line-dasharray": [4, 3],
              },
            },
            lineLayerBg,
          );
        });
      }

      // ---- Alert overlay ----
      const alertSourceId = "route-alerts";
      const alertFillId = "route-alerts-fill";
      const alertLineId = "route-alerts-line";
      [alertFillId, alertLineId].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(alertSourceId)) map.removeSource(alertSourceId);

      const alertFeatures = trip.alerts
        .map((a, i) => ({ alert: a, idx: i }))
        .filter(({ alert }) => alert.polygon_geojson)
        .map(({ alert, idx }) => ({
          type: "Feature" as const,
          id: idx,
          properties: {
            event: alert.event,
            severity: alert.severity,
            headline: alert.headline ?? "",
            fill: SEVERITY_FILL[alert.severity] ?? SEVERITY_FILL.Unknown,
            line: SEVERITY_LINE[alert.severity] ?? SEVERITY_LINE.Unknown,
          },
          geometry: alert.polygon_geojson as GeoJSON.Geometry,
        }));

      if (alertFeatures.length > 0) {
        // Read the live toggle value rather than depending on `showAlerts` —
        // the dedicated visibility effect below keeps it in sync without
        // forcing this whole (expensive) rebuild to re-run on every toggle.
        const alertsVisible = useUiStore.getState().showAlerts;
        map.addSource(alertSourceId, {
          type: "geojson",
          data: { type: "FeatureCollection", features: alertFeatures },
        });
        map.addLayer({
          id: alertFillId,
          type: "fill",
          source: alertSourceId,
          paint: {
            "fill-color": ["get", "fill"],
            "fill-opacity": 0.18,
          },
          layout: { visibility: alertsVisible ? "visible" : "none" },
        });
        map.addLayer({
          id: alertLineId,
          type: "line",
          source: alertSourceId,
          paint: {
            "line-color": ["get", "line"],
            "line-width": 1.8,
            "line-dasharray": [4, 2],
          },
          layout: { visibility: alertsVisible ? "visible" : "none" },
        });

        map.on("mouseenter", alertFillId, () => {
          map.getCanvas().style.cursor = "help";
        });
        map.on("mouseleave", alertFillId, () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", alertFillId, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          new mapboxgl.Popup({ offset: 10, maxWidth: "340px" })
            .setLngLat(e.lngLat)
            .setHTML(renderAlertPolygonPopup(f.properties as Record<string, string>))
            .addTo(map);
        });
      }

      // ---- Waypoint markers ----
      trip.waypoints.forEach((w) => {
        const el = document.createElement("div");
        el.className = "rp-marker";
        const hasAlert = w.active_alerts.length > 0;
        const worstSev = worstSeverity(w.active_alerts.map((i) => trip.alerts[i]));
        const badgeColor = worstSev ? SEVERITY_FILL[worstSev] ?? SEVERITY_FILL.Severe : "#ef4444";

        el.innerHTML = `
          <div class="rp-marker-pill${hasAlert ? " has-alert" : ""}">
            <span class="rp-marker-grade grade-${w.grade.letter.toLowerCase()}">${w.grade.letter}</span>
            <span class="rp-marker-icon" title="${
              w.forecast
                ? escapeHtml(w.forecast.summary) + " · " + Math.round(w.forecast.temp_f) + "°F"
                : "Forecast unavailable"
            }">${weatherIconSvg(w.forecast?.condition_code)}</span>
            ${
              hasAlert
                ? `<span class="rp-marker-alert" style="background:${badgeColor}" title="${escapeHtml(
                    worstSev ?? "Alert",
                  )} weather alert"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L22 20 L2 20 Z"/><line x1="12" y1="9" x2="12" y2="14"/><circle cx="12" cy="17.5" r="0.5" fill="white"/></svg></span>`
                : ""
            }
          </div>
          <div class="rp-marker-stem"></div>
        `;
        el.addEventListener("mouseenter", () => setHovered(w.index));
        el.addEventListener("mouseleave", () => setHovered(null));
        el.addEventListener("click", () => setSelectedWaypoint(w.index));
        if (useUiStore.getState().selectedWaypoint === w.index) {
          el.classList.add("is-selected");
        }

        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([w.lon, w.lat])
          .addTo(map);
        markersRef.current.push(marker);
        markerElementsRef.current.push(el);
      });

      // Hide overlapping markers immediately on first paint — the "move"
      // listener takes over for subsequent zoom/pan changes.
      updateMarkerVisibility(map, markersRef.current, markerElementsRef.current);

      // Keep any existing radar layers below the route line, regardless of
      // which effect added what first. moveLayer with a beforeId moves the
      // target so it renders directly underneath that layer.
      RADAR_ALL_LAYERS.forEach((id) => {
        if (map.getLayer(id) && map.getLayer(lineLayerBg)) {
          map.moveLayer(id, lineLayerBg);
        }
      });

      // Fit bounds.
      const [minLon, minLat, maxLon, maxLat] = trip.route.bounding_box as [
        number,
        number,
        number,
        number,
      ];
      map.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: 70, duration: 800 },
      );
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      // `styleVersion` is bumped by the `style.load` event, so if we reach
      // here the event already fired but `isStyleLoaded()` is transiently
      // false. Waiting for `idle` (which fires after tiles finish loading) is
      // more reliable than re-listening for `style.load`, which won't fire again.
      map.once("idle", apply);
    }
    // showAlerts intentionally omitted — toggling it is handled live by the
    // effect below without rebuilding markers/layers/route from scratch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { map.off("idle", apply); };
  }, [trip, setHovered, styleVersion]);

  // Toggle alert layer visibility live (without rebuilding markers).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    ALERT_LAYER_IDS.forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", showAlerts ? "visible" : "none");
      }
    });
  }, [showAlerts]);

  // Render / refresh the HRRR composite-reflectivity raster when the offset
  // or toggle changes. Also drives the "ghost driver" position marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !trip) return;

    const apply = () => {
      // ---- HRRR raster (double-buffered) ----
      if (radarEnabled) {
        const targetMs = departTimeMs(trip) + radarOffsetMin * 60_000;
        const pick = pickHrrrFrame(targetMs);
        // Insert UNDER the route line so the road stays legible. If route-line-bg
        // isn't built yet (race on initial mount), we'll fall back to top — the
        // next trip-render apply re-adds the line layers above us anyway.
        const beforeId = map.getLayer("route-line-bg") ? "route-line-bg" : undefined;
        swapRadarFrame(map, pick.tileUrl, beforeId, radarStateRef);
      } else {
        teardownRadar(map, radarStateRef);
      }

      // ---- Ghost driver marker ----
      if (radarEnabled) {
        const targetMs = departTimeMs(trip) + radarOffsetMin * 60_000;
        const [lon, lat] = positionAtTime(trip, targetMs);
        const feature: GeoJSON.Feature<GeoJSON.Point> = {
          type: "Feature",
          geometry: { type: "Point", coordinates: [lon, lat] },
          properties: {},
        };
        const src = map.getSource(GHOST_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
        if (src) {
          src.setData(feature);
        } else {
          map.addSource(GHOST_SOURCE_ID, { type: "geojson", data: feature });
          map.addLayer({
            id: GHOST_RING_LAYER_ID,
            type: "circle",
            source: GHOST_SOURCE_ID,
            paint: {
              "circle-radius": 14,
              "circle-color": "#7dd3fc",
              "circle-opacity": 0.25,
              "circle-stroke-width": 0,
            },
          });
          map.addLayer({
            id: GHOST_LAYER_ID,
            type: "circle",
            source: GHOST_SOURCE_ID,
            paint: {
              "circle-radius": 7,
              "circle-color": "#38bdf8",
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            },
          });
        }
      } else {
        [GHOST_LAYER_ID, GHOST_RING_LAYER_ID].forEach((id) => {
          if (map.getLayer(id)) map.removeLayer(id);
        });
        if (map.getSource(GHOST_SOURCE_ID)) map.removeSource(GHOST_SOURCE_ID);
      }
    };

    // The trip-render effect runs immediately before this one and calls
    // map.fitBounds (an 800ms camera animation). Adding a raster layer while
    // the map is mid-animation is unreliable — mapbox may not start fetching
    // tiles or paint the layer until something else nudges the render loop.
    // (That's why the radar only appeared after the user scrubbed: scrubbing
    // happens when the map is idle.) Defer to the next idle event whenever the
    // map isn't ready, which makes the initial-load path behave the same as
    // the user-toggles-radar-after-load path that has always worked.
    const ready = () => map.isStyleLoaded() && !map.isMoving();
    if (ready()) {
      apply();
    } else {
      const onIdle = () => {
        if (!mapRef.current) return;
        if (ready()) apply();
        else map.once("idle", onIdle);
      };
      map.once("idle", onIdle);
    }
  }, [trip, radarEnabled, radarOffsetMin, styleVersion]);

  // Render / remove weather overlays when activeOverlay changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const removeOverlay = (id: string) => {
      const isGeojson = id.startsWith("spc-day") || id.startsWith("wpc-ero-day");
      if (isGeojson) {
        const prefix = id.startsWith("spc-day")
          ? `overlay-spc-day${id.slice(-1)}`
          : `overlay-${id}`;
        [`${prefix}-line`, `${prefix}-fill`].forEach((lid) => {
          if (map.getLayer(lid)) map.removeLayer(lid);
        });
        if (map.getSource(`${prefix}-source`)) map.removeSource(`${prefix}-source`);
      } else {
        const layerId = `overlay-${id}-layer`;
        const sourceId = `overlay-${id}-source`;
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }
      activeOverlayIdsRef.current.delete(id);
    };

    const addSpcOverlay = async (id: string) => {
      const n = id.slice(-1);
      const sourceId = `overlay-spc-day${n}-source`;
      const fillId = `overlay-spc-day${n}-fill`;
      const lineId = `overlay-spc-day${n}-line`;
      try {
        const res = await fetch(`${API_BASE}/api/v1/overlay/spc-day${n}`);
        if (!res.ok) return;
        const geojson = await res.json();
        if (!map.isStyleLoaded()) return;
        if (map.getSource(sourceId)) return;
        map.addSource(sourceId, { type: "geojson", data: geojson });
        // The SPC GeoJSON already encodes the official colors in each feature's
        // "fill" and "stroke" properties — use them directly instead of a manual
        // match on "dn", which is what was producing solid grey.
        map.addLayer({
          id: fillId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": ["get", "fill"],
            "fill-opacity": 0.5,
          },
        });
        map.addLayer({
          id: lineId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": ["get", "stroke"],
            "line-width": 1.2,
            "line-opacity": 0.85,
          },
        });
        activeOverlayIdsRef.current.add(id);
      } catch {
        // Silently skip on fetch/parse error.
      }
    };

    const addWpcOverlay = async (id: string) => {
      try {
        const metaRes = await fetch(`${API_BASE}/api/v1/overlay/${id}`);
        if (!metaRes.ok) return;
        const meta = await metaRes.json();
        if (!map.isStyleLoaded()) return;

        if (meta.type === "geojson_proxy") {
          // WPC ERO — render as colored polygons keyed on the "dn" field.
          const sourceId = `overlay-${id}-source`;
          const fillId = `overlay-${id}-fill`;
          const lineId = `overlay-${id}-line`;
          if (map.getSource(sourceId)) return;
          const gjRes = await fetch(`${API_BASE}${meta.geojson_path}`);
          if (!gjRes.ok) return;
          const geojson = await gjRes.json();
          if (!map.isStyleLoaded()) return;
          // Official WPC ERO colors: dn 1=Marginal, 2=Slight, 3=Moderate, 4=High
          const eroColor: mapboxgl.Expression = [
            "match", ["get", "dn"],
            1, "#66bb33",
            2, "#ffff00",
            3, "#ff8c00",
            4, "#ff00ff",
            "#888888",
          ];
          map.addSource(sourceId, { type: "geojson", data: geojson });
          map.addLayer({
            id: fillId,
            type: "fill",
            source: sourceId,
            paint: { "fill-color": eroColor, "fill-opacity": 0.45 },
          });
          map.addLayer({
            id: lineId,
            type: "line",
            source: sourceId,
            paint: { "line-color": eroColor, "line-width": 1.5, "line-opacity": 0.85 },
          });
          activeOverlayIdsRef.current.add(id);
        } else {
          // image_proxy — WPC Hazards PNG. CORS is handled by the backend proxy.
          const sourceId = `overlay-${id}-source`;
          const layerId = `overlay-${id}-layer`;
          if (map.getSource(sourceId)) return;
          const bounds = meta.bounds as [[number, number], [number, number], [number, number], [number, number]];
          map.addSource(sourceId, {
            type: "image",
            url: `${API_BASE}${meta.image_path}`,
            coordinates: bounds,
          });
          map.addLayer({
            id: layerId,
            type: "raster",
            source: sourceId,
            paint: { "raster-opacity": 0.65 },
          });
          activeOverlayIdsRef.current.add(id);
        }
      } catch {
        // Silently skip on fetch/parse error.
      }
    };

    // Single-select: remove every currently painted overlay, then add the one
    // that's now active (if any).
    for (const id of [...activeOverlayIdsRef.current]) {
      removeOverlay(id);
    }
    if (activeOverlay) {
      if (activeOverlay.startsWith("spc-day")) {
        void addSpcOverlay(activeOverlay);
      } else {
        void addWpcOverlay(activeOverlay);
      }
    }
  }, [activeOverlay, styleVersion]);

  return (
    <div className="relative min-h-0 flex-1 w-full">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Floating overlay: alerts toggle + selected-waypoint alert card. */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowAlerts(!showAlerts)}
          className={`pointer-events-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur transition ${
            showAlerts
              ? "border-rose-300/60 bg-white/90 text-rose-700 hover:bg-white dark:border-rose-700/60 dark:bg-zinc-900/85 dark:text-rose-300"
              : "border-zinc-300/60 bg-white/85 text-zinc-600 hover:bg-white dark:border-zinc-700/60 dark:bg-zinc-900/80 dark:text-zinc-400"
          }`}
          title={showAlerts ? "Hide weather alerts on map" : "Show weather alerts on map"}
        >
          <span
            aria-hidden
            className={`inline-block h-2 w-2 rounded-full ${showAlerts ? "bg-rose-500" : "bg-zinc-400"}`}
          />
          {showAlerts ? "Alerts on" : "Alerts off"}
          {trip && trip.alerts.length > 0 && (
            <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
              {trip.alerts.length}
            </span>
          )}
        </button>
        {alertHtml && (
          <div
            ref={setAlertPanelEl}
            className="pointer-events-auto max-w-[300px] overflow-hidden rounded-xl border border-zinc-200/80 bg-white/90 shadow-md backdrop-blur dark:border-zinc-700/80 dark:bg-zinc-900/90"
            onClick={(e) => {
              const head = (e.target as HTMLElement).closest(".rp-alert-clickable");
              if (head) head.closest(".rp-alert-block")?.classList.toggle("is-open");
            }}
          />
        )}
      </div>

      <style jsx global>{`
        .rp-marker {
          cursor: pointer;
          transform: translateY(-4px);
          transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .rp-marker:hover, .rp-marker.is-active {
          transform: translateY(-8px) scale(1.06);
          z-index: 10;
        }
        .rp-marker.is-selected {
          transform: translateY(-8px) scale(1.06);
          z-index: 11;
        }
        .rp-marker.is-selected .rp-marker-pill {
          box-shadow:
            0 0 0 2px rgb(var(--accent-from)),
            0 6px 14px -4px rgba(15, 23, 42, 0.18),
            0 2px 4px rgba(15, 23, 42, 0.06);
        }
        .rp-marker-hidden {
          display: none;
        }
        .rp-marker-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
        }
        .rp-marker-pill {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px 5px 5px;
          background: white;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 999px;
          box-shadow:
            0 6px 14px -4px rgba(15, 23, 42, 0.18),
            0 2px 4px rgba(15, 23, 42, 0.06);
          font-size: 12px;
          font-weight: 600;
          color: #18181b;
        }
        .rp-marker-pill.has-alert {
          padding-right: 22px;
          box-shadow:
            0 0 0 2px rgba(239, 68, 68, 0.18),
            0 6px 14px -4px rgba(239, 68, 68, 0.45),
            0 2px 4px rgba(15, 23, 42, 0.08);
        }
        .dark .rp-marker-pill {
          background: #18181b;
          color: #f4f4f5;
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow:
            0 8px 18px -4px rgba(0, 0, 0, 0.6),
            0 2px 6px rgba(0, 0, 0, 0.3);
        }
        .dark .rp-marker-pill.has-alert {
          box-shadow:
            0 0 0 2px rgba(239, 68, 68, 0.32),
            0 8px 22px -4px rgba(239, 68, 68, 0.55),
            0 2px 6px rgba(0, 0, 0, 0.4);
        }
        .rp-marker-stem {
          width: 2px;
          height: 6px;
          margin: 0 auto;
          background: rgba(15, 23, 42, 0.18);
        }
        .dark .rp-marker-stem { background: rgba(255, 255, 255, 0.18); }
        .rp-marker-grade {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          color: white;
          font-weight: 800;
          font-size: 11px;
        }
        .rp-marker-alert {
          position: absolute;
          top: -6px;
          right: -6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(239, 68, 68, 0.5);
          animation: alert-pulse 1.8s ease-in-out infinite;
        }
        .dark .rp-marker-alert { border-color: #18181b; }
        @keyframes alert-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        .grade-a { background: #16a34a; }
        .grade-b { background: #84cc16; color: #18181b; }
        .grade-c { background: #f59e0b; color: #18181b; }
        .grade-d { background: #f97316; }
        .grade-f { background: #ef4444; }

        /* ---- Popover ---- */
        .rp-popup {
          padding: 16px 18px 14px;
          font-family: var(--font-inter), Inter, system-ui, sans-serif;
          max-height: 70vh;
          overflow-y: auto;
        }
        .rp-popup .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .rp-popup .place { font-size: 14px; font-weight: 600; line-height: 1.3; max-width: 230px; }
        .rp-popup .time { font-size: 11px; color: rgb(var(--muted)); margin-top: 2px; }
        .rp-popup .temp-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
        .rp-popup .temp { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }
        .rp-popup .rp-popup-icon { display: inline-flex; align-items: center; justify-content: center; }
        .rp-popup .rp-popup-icon svg { width: 26px; height: 26px; }
        .rp-popup .summary { font-size: 12px; color: rgb(var(--muted)); margin-top: -2px; }
        .rp-popup .grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px;
          margin-top: 12px; font-size: 12px;
        }
        .rp-popup .grid .k { color: rgb(var(--muted)); }
        .rp-popup .grid .v { font-weight: 500; }
        .rp-popup .reasons { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgb(var(--border)); font-size: 11px; color: rgb(var(--muted)); line-height: 1.6; }

        .rp-alert-block {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(239, 68, 68, 0.07);
          border: 1px solid rgba(239, 68, 68, 0.22);
        }
        .dark .rp-alert-block {
          background: rgba(239, 68, 68, 0.10);
          border-color: rgba(239, 68, 68, 0.32);
        }
        .rp-alert-block + .rp-alert-block { margin-top: 8px; }
        .rp-alert-clickable {
          cursor: pointer;
          user-select: none;
        }
        .rp-alert-clickable:hover .rp-alert-head span:first-child {
          text-decoration: underline;
        }
        .rp-alert-chev {
          display: inline-block;
          margin-left: 6px;
          font-size: 10px;
          opacity: 0.7;
          transition: transform 180ms ease;
        }
        .rp-alert-block.is-open .rp-alert-chev { transform: rotate(90deg); }
        .rp-alert-body { display: none; }
        .rp-alert-block.is-open .rp-alert-body { display: block; }
        .rp-alert-head {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
          font-size: 13px; font-weight: 600; color: #b91c1c;
        }
        .dark .rp-alert-head { color: #fca5a5; }
        .rp-alert-sev {
          font-size: 10px; font-weight: 700;
          padding: 2px 8px; border-radius: 999px;
          background: rgba(239, 68, 68, 0.15);
          color: #991b1b; letter-spacing: 0.04em; text-transform: uppercase;
          white-space: nowrap;
        }
        .dark .rp-alert-sev { color: #fecaca; background: rgba(239, 68, 68, 0.22); }
        .rp-alert-sev.sev-extreme { background: #991b1b; color: white; }
        .rp-alert-sev.sev-severe  { background: #dc2626; color: white; }
        .rp-alert-sev.sev-moderate{ background: #f97316; color: white; }
        .rp-alert-sev.sev-minor   { background: #eab308; color: #18181b; }
        .rp-alert-time {
          margin-top: 4px;
          font-size: 11px; color: rgb(var(--muted));
        }
        .rp-alert-headline {
          margin-top: 6px;
          font-size: 12px; line-height: 1.5;
          color: rgb(var(--foreground));
        }
        .rp-alert-desc {
          margin-top: 8px;
          font-size: 11px; line-height: 1.55; color: rgb(var(--muted));
          white-space: pre-wrap;
          max-height: 12em;
          overflow-y: auto;
          padding-right: 4px;
        }
        .rp-alert-banner {
          display: flex; align-items: center; gap: 6px;
          margin-top: 12px; margin-bottom: 4px;
          font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.06em;
          color: #b91c1c;
        }
        .dark .rp-alert-banner { color: #fca5a5; }
        .rp-alert-hint {
          margin: -2px 0 4px;
          font-size: 10px;
          color: rgb(var(--muted));
          font-style: italic;
        }

        .rp-popup .grade-big {
          width: 40px; height: 40px; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 18px; color: white;
          box-shadow: 0 4px 10px -2px rgba(0,0,0,0.15);
        }

        /* Sidebar embedding: the popup content is reused inside .card panels,
           which should size to their content rather than scroll like the
           compact map popover. */
        .card .rp-popup {
          padding: 18px 20px;
          max-height: none;
          overflow-y: visible;
        }
        .card .rp-alert-desc {
          max-height: none;
          overflow-y: visible;
        }
      `}</style>
    </div>
  );
}

// Swap to a new HRRR frame.
//   - First frame ever: paint at full opacity immediately (no previous to fade
//     from, and waiting for `sourcedata` is unreliable when tiles are cached).
//   - Subsequent frames: add the new slot at opacity 0, wait for tiles to load
//     (sourcedata `isSourceLoaded`, with `idle` as a fallback in case the
//     event fires before we attached or for fully-cached tiles), then fade new
//     in and old out together. Old layer is removed after the fade completes.
// If the user scrubs again mid-swap, the not-yet-visible pending slot is torn
// down — the currently visible frame is never touched, so there's no gap.
function swapRadarFrame(
  map: mapboxgl.Map,
  newUrl: string,
  beforeId: string | undefined,
  stateRef: { current: RadarState },
): void {
  const state = stateRef.current;
  if (state.currentUrl === newUrl && state.pendingUrl === null) return;
  if (state.pendingUrl === newUrl) return;

  // Cancel any pending swap.
  if (state.pendingHandler) {
    map.off("sourcedata", state.pendingHandler);
    state.pendingHandler = null;
  }
  if (state.pendingSlot) {
    const sId = RADAR_SOURCES[state.pendingSlot];
    const lId = RADAR_LAYERS[state.pendingSlot];
    if (map.getLayer(lId)) map.removeLayer(lId);
    if (map.getSource(sId)) map.removeSource(sId);
    state.pendingSlot = null;
    state.pendingUrl = null;
  }

  const newSlot: RadarSlot = state.currentSlot === "a" ? "b" : "a";
  const newSourceId = RADAR_SOURCES[newSlot];
  const newLayerId = RADAR_LAYERS[newSlot];
  if (map.getLayer(newLayerId)) map.removeLayer(newLayerId);
  if (map.getSource(newSourceId)) map.removeSource(newSourceId);

  map.addSource(newSourceId, {
    type: "raster",
    tiles: [newUrl],
    tileSize: 256,
    attribution: "HRRR composite reflectivity · NOAA / Iowa State IEM",
  });

  const firstFrame = state.currentSlot === null;
  if (firstFrame) {
    // First frame — no previous to crossfade from. Add at full opacity; the
    // radar effect only calls this when the map is idle (see the once("idle")
    // guard in the radar useEffect), so tiles will fetch and paint normally.
    map.addLayer(
      {
        id: newLayerId,
        type: "raster",
        source: newSourceId,
        paint: { "raster-opacity": RADAR_OPACITY, "raster-fade-duration": 300 },
      },
      beforeId,
    );
    state.currentSlot = newSlot;
    state.currentUrl = newUrl;
    return;
  }

  // Subsequent frames: stage at opacity 0, crossfade once tiles paint.
  map.addLayer(
    {
      id: newLayerId,
      type: "raster",
      source: newSourceId,
      paint: {
        "raster-opacity": 0,
        "raster-opacity-transition": { duration: RADAR_FADE_MS, delay: 0 },
        "raster-fade-duration": 0,
      },
    },
    beforeId,
  );

  state.pendingSlot = newSlot;
  state.pendingUrl = newUrl;

  const fadeIn = () => {
    // Idempotent — multiple triggers (sourcedata + idle) can race.
    if (state.pendingSlot !== newSlot || state.pendingUrl !== newUrl) return;
    if (state.pendingHandler) {
      map.off("sourcedata", state.pendingHandler);
      state.pendingHandler = null;
    }
    if (map.getLayer(newLayerId)) {
      map.setPaintProperty(newLayerId, "raster-opacity", RADAR_OPACITY);
    }
    const oldSlot = state.currentSlot;
    if (oldSlot && oldSlot !== newSlot) {
      const oldLayerId = RADAR_LAYERS[oldSlot];
      const oldSourceId = RADAR_SOURCES[oldSlot];
      if (map.getLayer(oldLayerId)) {
        map.setPaintProperty(oldLayerId, "raster-opacity", 0);
      }
      window.setTimeout(() => {
        if (map.getLayer(oldLayerId)) map.removeLayer(oldLayerId);
        if (map.getSource(oldSourceId)) map.removeSource(oldSourceId);
      }, RADAR_FADE_MS + 60);
    }
    state.currentSlot = newSlot;
    state.currentUrl = newUrl;
    state.pendingSlot = null;
    state.pendingUrl = null;
  };

  const handler = (e: { sourceId?: string; isSourceLoaded?: boolean }) => {
    if (e.sourceId !== newSourceId) return;
    if (!e.isSourceLoaded) return;
    fadeIn();
  };
  state.pendingHandler = handler;
  map.on("sourcedata", handler);
  // Fallback: when the map has nothing left to load, fade in regardless.
  map.once("idle", () => {
    if (state.pendingSlot === newSlot && state.pendingUrl === newUrl) fadeIn();
  });
}

function teardownRadar(
  map: mapboxgl.Map,
  stateRef: { current: RadarState },
): void {
  const state = stateRef.current;
  if (state.pendingHandler) {
    map.off("sourcedata", state.pendingHandler);
  }
  RADAR_ALL_LAYERS.forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  RADAR_ALL_SOURCES.forEach((id) => {
    if (map.getSource(id)) map.removeSource(id);
  });
  stateRef.current = {
    currentSlot: null,
    currentUrl: null,
    pendingSlot: null,
    pendingUrl: null,
    pendingHandler: null,
  };
}
