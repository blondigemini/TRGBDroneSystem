import { useState, useEffect, useRef } from "react";
import { useDashboardStore } from "../stores/dashboardStore";
import type { DroneTelemetry, GPSCoord } from "../types/telemetry";
import type { DetectionResult } from "../types/detection";
import type { Alert } from "../types/alert";

const VIDEO_URL =
  "https://www.youtube.com/embed/ffV5tmrrgMA?autoplay=1&mute=1&loop=1&playlist=ffV5tmrrgMA&controls=0";

// Lusail, Qatar base coordinates
const BASE_LAT = 25.4183;
const BASE_LNG = 51.4914;

const FIRE_SCENARIOS: Omit<DetectionResult, "timestamp" | "image_id">[] = [
  {
    model_type: "fusion",
    classification: "fire",
    confidence: 0.94,
    severity: "critical",
    hotspots: [
      { x: 0.12, y: 0.28, width: 0.22, height: 0.28 },
      { x: 0.62, y: 0.18, width: 0.18, height: 0.22 },
    ],
    image_url: VIDEO_URL,
  },
  {
    model_type: "fusion",
    classification: "fire",
    confidence: 0.87,
    severity: "high",
    hotspots: [{ x: 0.3, y: 0.38, width: 0.28, height: 0.24 }],
    image_url: VIDEO_URL,
  },
  {
    model_type: "fusion",
    classification: "fire",
    confidence: 0.91,
    severity: "critical",
    hotspots: [
      { x: 0.08, y: 0.4, width: 0.32, height: 0.3 },
      { x: 0.55, y: 0.3, width: 0.24, height: 0.2 },
      { x: 0.72, y: 0.55, width: 0.16, height: 0.18 },
    ],
    image_url: VIDEO_URL,
  },
  {
    model_type: "fusion",
    classification: "no_fire",
    confidence: 0.12,
    severity: "none",
    hotspots: [],
    image_url: VIDEO_URL,
  },
];

const ALERT_MESSAGES = [
  (s: string, lat: number, lng: number) =>
    `Fire hotspot detected at ${lat.toFixed(4)}°N ${lng.toFixed(4)}°E — severity ${s.toUpperCase()}`,
  (s: string, lat: number, lng: number) =>
    `Thermal anomaly confirmed at ${lat.toFixed(4)}°N ${lng.toFixed(4)}°E — ${s} risk`,
  (s: string, lat: number, lng: number) =>
    `Active fire spread detected — sector ${lat.toFixed(4)}°N ${lng.toFixed(4)}°E — ${s.toUpperCase()} alert`,
];

function jitter(base: number, amount = 0.002) {
  return base + (Math.random() - 0.5) * amount;
}

export function useDemoFeed() {
  const setWsConnected = useDashboardStore((s) => s.setWsConnected);

  const [telemetry, setTelemetry] = useState<DroneTelemetry>({
    timestamp: new Date().toISOString(),
    gps: { lat: BASE_LAT, lng: BASE_LNG },
    altitude_m: 45.0,
    speed_mps: 8.2,
    heading_deg: 270,
    battery_pct: 82,
    signal_strength: 94,
    camera_mode: "thermal",
  });

  const [latestDetection, setLatestDetection] = useState<DetectionResult | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const scenarioRef = useRef(0);
  const tickRef = useRef(0);

  useEffect(() => {
    setWsConnected(true);
    return () => setWsConnected(false);
  }, [setWsConnected]);

  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current += 1;
      const tick = tickRef.current;

      // Update telemetry every tick
      setTelemetry((prev) => ({
        ...prev,
        timestamp: new Date().toISOString(),
        gps: {
          lat: jitter(prev.gps.lat, 0.001),
          lng: jitter(prev.gps.lng, 0.001),
        },
        altitude_m: Math.max(30, Math.min(80, prev.altitude_m + (Math.random() - 0.5) * 2)),
        speed_mps: Math.max(4, Math.min(14, prev.speed_mps + (Math.random() - 0.5))),
        battery_pct: Math.max(20, prev.battery_pct - 0.1),
        signal_strength: Math.max(60, Math.min(100, prev.signal_strength + (Math.random() - 0.5) * 3)),
        heading_deg: (prev.heading_deg + 1) % 360,
      }));

      // Cycle detection every 4 ticks
      if (tick % 4 === 0) {
        const idx = scenarioRef.current % FIRE_SCENARIOS.length;
        scenarioRef.current += 1;
        const scenario = FIRE_SCENARIOS[idx];

        const detection: DetectionResult = {
          ...scenario,
          timestamp: new Date().toISOString(),
          image_id: `demo-${tick}`,
        };
        setLatestDetection(detection);

        // Generate alert on fire detections
        if (scenario.classification === "fire") {
          setTelemetry((prev) => {
            const gps: GPSCoord = { lat: prev.gps.lat, lng: prev.gps.lng };
            const msgFn = ALERT_MESSAGES[Math.floor(Math.random() * ALERT_MESSAGES.length)];
            const alert: Alert = {
              id: `demo-alert-${Date.now()}`,
              timestamp: new Date().toISOString(),
              severity: scenario.severity,
              message: msgFn(scenario.severity, gps.lat, gps.lng),
              gps,
              detection,
              acknowledged: false,
              mission_id: null,
            };
            setAlerts((prev) => [alert, ...prev].slice(0, 20));
            return prev;
          });
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return { telemetry, latestDetection, alerts };
}
