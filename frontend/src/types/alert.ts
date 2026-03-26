import type { GPSCoord } from "./telemetry";
import type { DetectionResult } from "./detection";

export interface Alert {
  id: string;
  timestamp: string;
  severity: string;
  message: string;
  gps: GPSCoord;
  detection: DetectionResult;
  acknowledged: boolean;
  mission_id: string | null;
}

export interface AlertStats {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}
