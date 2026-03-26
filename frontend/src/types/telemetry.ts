export interface GPSCoord {
  lat: number;
  lng: number;
}

export interface DroneTelemetry {
  timestamp: string;
  gps: GPSCoord;
  altitude_m: number;
  speed_mps: number;
  heading_deg: number;
  battery_pct: number;
  signal_strength: number;
  camera_mode: string;
}
