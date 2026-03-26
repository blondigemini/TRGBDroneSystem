export interface Waypoint {
  lat: number;
  lng: number;
  altitude_m: number;
}

export interface Mission {
  id: string;
  name: string;
  area_name: string;
  waypoints: Waypoint[];
  camera_mode: string;
  status: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  detections_count: number;
  alerts_count: number;
  distance_km: number;
}

export interface MissionCreate {
  name: string;
  area_name: string;
  waypoints: Waypoint[];
  camera_mode: string;
}
