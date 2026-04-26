// stores/detectionStore.ts
import { create } from 'zustand';
import type { ModelResult, YoloResult, AllModelsResult } from '../api/detection';

export type ScanMode = 'quick' | 'yolo' | 'fusion';

interface DetectionState {
  activeMode: ScanMode;
  quickResults: AllModelsResult | null;
  yoloResult: YoloResult | null;
  fusionResult: ModelResult | null;

  setActiveMode: (mode: ScanMode) => void;
  setQuickResults: (r: AllModelsResult) => void;
  setYoloResult: (r: YoloResult) => void;
  setFusionResult: (r: ModelResult) => void;
  clearResults: () => void;
}

export const useDetectionStore = create<DetectionState>((set) => ({
  activeMode: 'quick',
  quickResults: null,
  yoloResult: null,
  fusionResult: null,

  setActiveMode: (mode) => set({ activeMode: mode }),
  setQuickResults: (r) => set({ quickResults: r }),
  setYoloResult: (r) => set({ yoloResult: r }),
  setFusionResult: (r) => set({ fusionResult: r }),
  clearResults: () => set({ quickResults: null, yoloResult: null, fusionResult: null }),
}));
