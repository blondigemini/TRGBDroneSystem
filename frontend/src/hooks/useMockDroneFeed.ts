import { useEffect, useRef, useState, useCallback } from "react";
import type { DroneTelemetry, GPSCoord } from "../types/telemetry";
import type { DetectionResult, BoundingBox } from "../types/detection";
import type { Alert } from "../types/alert";
import { useDashboardStore } from "../stores/dashboardStore";

const TICK_MS = 1500;
const DETECTION_EVERY_N = 4;
const CENTER_LAT = 25.3548;
const CENTER_LNG = 51.4382;
const SCAN_LINES = 8;
const STEP_LNG = 0.0005;
const LINE_SPACING = 0.003;
const LINE_WIDTH = 0.025;

// Real aerial wildfire footage — RAW drone footage, Maui wildfires Aug 2023 (active fire/smoke visible)
// Replace VIDEO_ID to swap footage: https://www.youtube.com/watch?v=VIDEO_ID
const DEMO_VIDEO_URL =
  "https://www.youtube.com/embed/ffV5tmrrgMA?autoplay=1&mute=1&loop=1&playlist=ffV5tmrrgMA&controls=0&rel=0&playsinline=1";

// FLIR iron colormap: [normalised position, r, g, b]
const IRON_STOPS: [number, number, number, number][] = [
  [0.00,   0,   0,   0],
  [0.11,  20,   0,  55],
  [0.22,  82,   0, 115],
  [0.35, 175,  12,  52],
  [0.48, 218,  38,   6],
  [0.62, 244, 105,   0],
  [0.75, 255, 178,  18],
  [0.88, 255, 238,  95],
  [1.00, 255, 255, 255],
];

function ironColormap(t: number): [number, number, number] {
  const v = Math.min(1, Math.max(0, t));
  for (let i = 1; i < IRON_STOPS.length; i++) {
    if (v <= IRON_STOPS[i][0]) {
      const a = IRON_STOPS[i - 1];
      const b = IRON_STOPS[i];
      const p = (v - a[0]) / (b[0] - a[0]);
      return [
        Math.round(a[1] + p * (b[1] - a[1])),
        Math.round(a[2] + p * (b[2] - a[2])),
        Math.round(a[3] + p * (b[3] - a[3])),
      ];
    }
  }
  return [255, 255, 255];
}

interface DetectionScenario {
  classification: string;
  confidence: number;
  severity: string;
  hotspots: BoundingBox[];
  sector: string;
}

const SCENARIOS: DetectionScenario[] = [
  {
    classification: "fire",
    confidence: 0.94,
    severity: "critical",
    sector: "Alpha",
    hotspots: [
      { x: 0.26, y: 0.34, width: 0.14, height: 0.17 },
      { x: 0.54, y: 0.50, width: 0.09, height: 0.12 },
    ],
  },
  {
    classification: "fire",
    confidence: 0.82,
    severity: "high",
    sector: "Bravo",
    hotspots: [{ x: 0.40, y: 0.41, width: 0.15, height: 0.18 }],
  },
  {
    classification: "no_fire",
    confidence: 0.11,
    severity: "none",
    sector: "Charlie",
    hotspots: [],
  },
  {
    classification: "fire",
    confidence: 0.76,
    severity: "high",
    sector: "Delta",
    hotspots: [{ x: 0.61, y: 0.30, width: 0.12, height: 0.15 }],
  },
];

// City-block grid constants (pixels)
const BLK_W = 86;
const BLK_H = 56;
const ST_W = 17;
const CELL_W = BLK_W + ST_W;
const CELL_H = BLK_H + ST_W;
const OX = 8;  // grid origin offset x
const OY = 5;  // grid origin offset y

function buildTempMap(W: number, H: number, hotspots: BoundingBox[], isFire: boolean): Uint8ClampedArray {
  // Allocate greyscale temperature map: 0=cold, 255=hottest
  const temps = new Uint8ClampedArray(W * H);

  // ── Ambient ground (100) ──────────────────────────────────────────────────
  temps.fill(100);

  // ── Streets (76) ─────────────────────────────────────────────────────────
  for (let col = 0; col * CELL_W < W + CELL_W; col++) {
    const sx = OX + col * CELL_W + BLK_W;
    for (let py = 0; py < H; py++) {
      for (let dx = 0; dx < ST_W && sx + dx < W; dx++) {
        if (sx + dx >= 0) temps[py * W + sx + dx] = 76;
      }
    }
  }
  for (let row = 0; row * CELL_H < H + CELL_H; row++) {
    const sy = OY + row * CELL_H + BLK_H;
    for (let px = 0; px < W; px++) {
      for (let dy = 0; dy < ST_W && sy + dy < H; dy++) {
        if (sy + dy >= 0) temps[(sy + dy) * W + px] = 76;
      }
    }
  }

  // ── Building rooftops (128–154, per-building variation) ──────────────────
  for (let row = -1; row * CELL_H < H + CELL_H; row++) {
    for (let col = -1; col * CELL_W < W + CELL_W; col++) {
      const bx0 = OX + col * CELL_W;
      const by0 = OY + row * CELL_H;
      const bx1 = Math.min(W, bx0 + BLK_W);
      const by1 = Math.min(H, by0 + BLK_H);
      if (bx1 <= 0 || by1 <= 0 || bx0 >= W || by0 >= H) continue;

      const hash = (((row * 13 + col * 7) * 31) & 0x7f);
      const baseTemp = 128 + (hash % 26);

      for (let py = Math.max(0, by0); py < by1; py++) {
        for (let px = Math.max(0, bx0); px < bx1; px++) {
          // Slight intra-roof noise for texture
          const noise = ((px * 3 + py * 5) % 7) - 3;
          temps[py * W + px] = Math.min(255, Math.max(0, baseTemp + noise));
        }
      }

      // HVAC units: small hot rectangles (175–190) on every other building
      if ((row + col * 3) % 2 === 0) {
        const hx = Math.max(0, bx0 + 9);
        const hy = Math.max(0, by0 + 7);
        const hvacTemp = 175 + (hash % 15);
        for (let py = hy; py < Math.min(H, hy + 7) && py < by1; py++) {
          for (let px = hx; px < Math.min(W, hx + 10) && px < bx1; px++) {
            temps[py * W + px] = hvacTemp;
          }
        }
        const hx2 = Math.min(W - 1, bx1 - 18);
        const hy2 = Math.min(H - 1, by1 - 13);
        for (let py = hy2; py < Math.min(H, hy2 + 8) && py < by1; py++) {
          for (let px = hx2; px < Math.min(W, hx2 + 13) && px < bx1; px++) {
            temps[py * W + px] = hvacTemp + 5;
          }
        }
      }
    }
  }

  // ── Vegetation patches (50–60) ───────────────────────────────────────────
  const VEG = [
    { cx: 152, cy: 258, rx: 54, ry: 30 },
    { cx: 498, cy: 78, rx: 44, ry: 26 },
    { cx: 575, cy: 293, rx: 36, ry: 22 },
  ];
  for (const v of VEG) {
    const x0 = Math.max(0, Math.round(v.cx - v.rx - 2));
    const x1 = Math.min(W, Math.round(v.cx + v.rx + 2));
    const y0 = Math.max(0, Math.round(v.cy - v.ry - 2));
    const y1 = Math.min(H, Math.round(v.cy + v.ry + 2));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const nx = (px - v.cx) / v.rx;
        const ny = (py - v.cy) / v.ry;
        if (nx * nx + ny * ny <= 1) {
          const noise = (px * 7 + py * 3) % 8;
          temps[py * W + px] = 50 + noise;
        }
      }
    }
  }

  // ── Fire hotspots ─────────────────────────────────────────────────────────
  if (isFire) {
    for (const hs of hotspots) {
      const cx = (hs.x + hs.width / 2) * W;
      const cy = (hs.y + hs.height / 2) * H;
      const r = Math.max(hs.width * W, hs.height * H) * 0.72;
      const r2 = r * r;
      const outerR = r * 2.8;
      const outerR2 = outerR * outerR;

      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const dx = px - cx;
          const dy = py - cy;
          const d2 = dx * dx + dy * dy;

          if (d2 > outerR2) continue;

          const d = Math.sqrt(d2);
          let contribution: number;

          if (d <= r) {
            // Core: 210 → 255 (white-hot centre)
            const t = d / r;
            contribution = Math.round(255 - t * t * 45);
          } else {
            // Heat halo: 200 → ambient
            const t = (d - r) / (outerR - r);
            contribution = Math.round(205 - t * t * 105);
          }

          const idx = py * W + px;
          if (contribution > temps[idx]) temps[idx] = contribution;
        }
      }
    }
  }

  return temps;
}

function generateThermalImage(hotspots: BoundingBox[], isFire: boolean, frameIdx: number): string {
  const W = 640, H = 360;

  const temps = buildTempMap(W, H, hotspots, isFire);

  // Apply iron colormap → output canvas
  const outCanvas = document.createElement("canvas");
  outCanvas.width = W;
  outCanvas.height = H;
  const outCtx = outCanvas.getContext("2d")!;
  const imgData = outCtx.createImageData(W, H);

  for (let i = 0; i < W * H; i++) {
    const [r, g, b] = ironColormap(temps[i] / 255);
    imgData.data[i * 4]     = r;
    imgData.data[i * 4 + 1] = g;
    imgData.data[i * 4 + 2] = b;
    imgData.data[i * 4 + 3] = 255;
  }
  outCtx.putImageData(imgData, 0, 0);

  // ── HUD overlays ─────────────────────────────────────────────────────────
  const now = new Date();
  const ts = now.toISOString().replace("T", " ").slice(0, 19);
  const green = "rgba(0,255,80,0.88)";

  outCtx.font = "bold 11px monospace";
  outCtx.fillStyle = green;
  outCtx.fillText("TRGB-01  THERMAL/IR", 8, 14);
  outCtx.fillText(`${ts} UTC`, 8, 27);
  outCtx.fillText(
    `ALT: ${(120 + (frameIdx % 5) * 0.3).toFixed(1)}m   SPD: ${(7 + (frameIdx % 3))}m/s   HDG: 092°`,
    8, 40
  );

  // Temperature scale bar (right edge)
  const SX = W - 22, SY = 20, SH = H - 40;
  const barGrd = outCtx.createLinearGradient(0, SY, 0, SY + SH);
  const colourStops: [number, string][] = [
    [0.0, "rgb(255,255,255)"],
    [0.25, "rgb(255,178,18)"],
    [0.52, "rgb(218,38,6)"],
    [0.78, "rgb(82,0,115)"],
    [1.0, "rgb(0,0,0)"],
  ];
  for (const [pos, col] of colourStops) barGrd.addColorStop(pos, col);
  outCtx.fillStyle = barGrd;
  outCtx.fillRect(SX, SY, 12, SH);
  outCtx.strokeStyle = "rgba(255,255,255,0.35)";
  outCtx.lineWidth = 1;
  outCtx.strokeRect(SX, SY, 12, SH);
  outCtx.font = "9px monospace";
  outCtx.fillStyle = "rgba(255,255,255,0.65)";
  outCtx.fillText("HOT", SX - 1, SY + 9);
  outCtx.fillText("CLD", SX - 1, SY + SH);

  // Centre crosshair
  const CX = W / 2, CY = H / 2;
  outCtx.strokeStyle = "rgba(0,255,80,0.45)";
  outCtx.lineWidth = 1;
  outCtx.beginPath();
  outCtx.moveTo(CX - 16, CY); outCtx.lineTo(CX - 5, CY);
  outCtx.moveTo(CX + 5,  CY); outCtx.lineTo(CX + 16, CY);
  outCtx.moveTo(CX, CY - 16); outCtx.lineTo(CX, CY - 5);
  outCtx.moveTo(CX, CY + 5);  outCtx.lineTo(CX, CY + 16);
  outCtx.stroke();

  // Frame counter
  outCtx.font = "9px monospace";
  outCtx.fillStyle = "rgba(0,255,80,0.65)";
  outCtx.fillText(`FRM:${String(frameIdx).padStart(4, "0")}`, W - 68, H - 7);

  return outCanvas.toDataURL("image/jpeg", 0.88);
}

function makeDronePosition(tick: number): GPSCoord {
  const stepsPerLine = Math.round(LINE_WIDTH / STEP_LNG);
  const totalSteps = stepsPerLine * SCAN_LINES;
  const t = tick % totalSteps;
  const line = Math.floor(t / stepsPerLine);
  const stepInLine = t % stepsPerLine;
  const lat = CENTER_LAT - (SCAN_LINES / 2) * LINE_SPACING + line * LINE_SPACING;
  const lngOffset = (stepInLine / stepsPerLine) * LINE_WIDTH - LINE_WIDTH / 2;
  const lng = CENTER_LNG + (line % 2 === 0 ? lngOffset : -lngOffset);
  return { lat, lng };
}

function jitter(base: number, range: number): number {
  return base + (Math.random() * 2 - 1) * range;
}

export function useMockDroneFeed() {
  const [telemetry, setTelemetry] = useState<DroneTelemetry | null>(null);
  const [latestDetection, setLatestDetection] = useState<DetectionResult | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [flightPath, setFlightPath] = useState<GPSCoord[]>([]);
  const [hotspots, setHotspots] = useState<{ gps: GPSCoord; severity: string }[]>([]);
  const tickRef = useRef(0);
  const scenarioRef = useRef(0);
  const batteryRef = useRef(87.0);
  const setWsConnected = useDashboardStore((s) => s.setWsConnected);

  useEffect(() => {
    setWsConnected(true);

    const interval = setInterval(() => {
      tickRef.current += 1;
      const tick = tickRef.current;

      batteryRef.current = Math.max(0, batteryRef.current - 0.05);

      const gps = makeDronePosition(tick);

      const tel: DroneTelemetry = {
        timestamp: new Date().toISOString(),
        gps,
        altitude_m: jitter(120, 1.5),
        speed_mps: jitter(8, 0.8),
        heading_deg: jitter(92, 4),
        battery_pct: parseFloat(batteryRef.current.toFixed(2)),
        signal_strength: jitter(93, 2),
        camera_mode: "thermal",
      };

      setTelemetry(tel);
      setFlightPath((prev) => [...prev.slice(-500), gps]);

      if (tick % DETECTION_EVERY_N === 0) {
        const scenario = SCENARIOS[scenarioRef.current % SCENARIOS.length];
        scenarioRef.current += 1;

        const imageUrl = DEMO_VIDEO_URL;

        const detection: DetectionResult = {
          timestamp: new Date().toISOString(),
          image_id: `mock-${tick}`,
          model_type: "fusion",
          classification: scenario.classification,
          confidence: scenario.confidence,
          severity: scenario.severity,
          hotspots: scenario.hotspots,
          image_url: imageUrl,
        };

        setLatestDetection(detection);

        if (scenario.classification === "fire") {
          const alert: Alert = {
            id: `alert-${tick}`,
            timestamp: new Date().toISOString(),
            severity: scenario.severity,
            message: `Fire detected in Sector ${scenario.sector} — confidence ${Math.round(scenario.confidence * 100)}% (${scenario.severity.toUpperCase()})`,
            gps,
            detection,
            acknowledged: false,
            mission_id: "mock-mission-1",
          };

          setAlerts((prev) => [alert, ...prev].slice(0, 100));
          setHotspots((prev) => [...prev.slice(-50), { gps, severity: scenario.severity }]);
        }
      }
    }, TICK_MS);

    return () => {
      clearInterval(interval);
      setWsConnected(false);
    };
  }, [setWsConnected]);

  const sendCommand = useCallback((_cmd: object) => {
    // Pause / camera-mode handled locally via dashboardStore
  }, []);

  return { telemetry, latestDetection, alerts, flightPath, hotspots, sendCommand };
}
