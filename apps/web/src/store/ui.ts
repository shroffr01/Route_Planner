"use client";
import { create } from "zustand";

type UiState = {
  hoveredWaypoint: number | null;
  setHoveredWaypoint: (i: number | null) => void;

  showAlerts: boolean;
  setShowAlerts: (v: boolean) => void;

  radarEnabled: boolean;
  setRadarEnabled: (v: boolean) => void;

  // Minutes from depart time. The radar scrubber writes here; the map reads it
  // to pick a tile frame and to position the "you'll be here" ghost marker.
  radarOffsetMin: number;
  setRadarOffsetMin: (m: number) => void;

  activeOverlay: string | null;
  setActiveOverlay: (id: string | null) => void;

  // Index of the waypoint whose info panel is shown in the left column.
  selectedWaypoint: number | null;
  setSelectedWaypoint: (i: number | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
  hoveredWaypoint: null,
  setHoveredWaypoint: (i) => set({ hoveredWaypoint: i }),

  showAlerts: true,
  setShowAlerts: (v) => set({ showAlerts: v }),

  radarEnabled: true,
  setRadarEnabled: (v) => set({ radarEnabled: v }),

  radarOffsetMin: 0,
  setRadarOffsetMin: (m) => set({ radarOffsetMin: m }),

  activeOverlay: null,
  setActiveOverlay: (id) => set({ activeOverlay: id }),

  selectedWaypoint: null,
  setSelectedWaypoint: (i) => set({ selectedWaypoint: i }),
}));
