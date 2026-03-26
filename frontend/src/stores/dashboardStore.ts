import { create } from "zustand";

interface DashboardState {
  activeMissionId: string | null;
  cameraMode: "thermal" | "rgb";
  feedPaused: boolean;
  audioEnabled: boolean;
  wsConnected: boolean;
  setActiveMission: (id: string | null) => void;
  setCameraMode: (mode: "thermal" | "rgb") => void;
  toggleFeedPaused: () => void;
  toggleAudio: () => void;
  setWsConnected: (connected: boolean) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  activeMissionId: null,
  cameraMode: "thermal",
  feedPaused: false,
  audioEnabled: true,
  wsConnected: false,
  setActiveMission: (id) => set({ activeMissionId: id }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  toggleFeedPaused: () => set((s) => ({ feedPaused: !s.feedPaused })),
  toggleAudio: () => set((s) => ({ audioEnabled: !s.audioEnabled })),
  setWsConnected: (connected) => set({ wsConnected: connected }),
}));
