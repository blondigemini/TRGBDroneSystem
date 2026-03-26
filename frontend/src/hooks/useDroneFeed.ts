import { useEffect, useRef, useState, useCallback } from "react";
import type { DroneTelemetry, GPSCoord } from "../types/telemetry";
import type { DetectionResult } from "../types/detection";
import type { Alert } from "../types/alert";
import { WS_URL } from "../utils/constants";
import { useDashboardStore } from "../stores/dashboardStore";

export function useDroneFeed() {
  const [telemetry, setTelemetry] = useState<DroneTelemetry | null>(null);
  const [latestDetection, setLatestDetection] =
    useState<DetectionResult | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [flightPath, setFlightPath] = useState<GPSCoord[]>([]);
  const [hotspots, setHotspots] = useState<
    { gps: GPSCoord; severity: string }[]
  >([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reconnectDelay = useRef(1000);
  const setWsConnected = useDashboardStore((s) => s.setWsConnected);

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      reconnectDelay.current = 1000;
    };

    ws.onclose = () => {
      setWsConnected(false);
      reconnectTimeout.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        connect();
      }, reconnectDelay.current);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "telemetry_update":
          setTelemetry(msg.data);
          setFlightPath((prev) => [...prev.slice(-500), msg.data.gps]);
          break;
        case "detection_result":
          setLatestDetection(msg.data);
          break;
        case "alert":
          setAlerts((prev) => [msg.data, ...prev].slice(0, 100));
          if (msg.data.detection?.classification === "fire") {
            setHotspots((prev) => [
              ...prev.slice(-50),
              { gps: msg.data.gps, severity: msg.data.severity },
            ]);
          }
          break;
      }
    };
  }, [setWsConnected]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendCommand = useCallback((cmd: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    }
  }, []);

  return {
    telemetry,
    latestDetection,
    alerts,
    flightPath,
    hotspots,
    sendCommand,
  };
}
