// types/detection.ts
// Shared detection types used by the live feed and WebSocket layer.
// The API-specific types (ModelResult, YoloResult, etc.) live in api/detection.ts.

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  timestamp: string;
  image_id: string;
  model_type: string;
  classification: string;
  confidence: number;
  severity: string;
  hotspots: BoundingBox[];
  image_url: string;
}
