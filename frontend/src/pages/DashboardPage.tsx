import type { DroneTelemetry } from "../types/telemetry";
import type { DetectionResult } from "../types/detection";
import type { Alert } from "../types/alert";
import type { GPSCoord } from "../types/telemetry";
import { LiveFeed } from "../components/feed/LiveFeed";
import { MapView } from "../components/map/MapView";
import { AlertPanel } from "../components/alerts/AlertPanel";
import { StatusBar } from "../components/status/StatusBar";
import { MissionControl } from "../components/mission/MissionControl";
import { useDashboardStore } from "../stores/dashboardStore";
import { DetectionPanel } from "../components/detection/DetectionPanel";

interface Props {
  telemetry: DroneTelemetry | null;
  latestDetection: DetectionResult | null;
  alerts: Alert[];
  flightPath: GPSCoord[];
  hotspots: { gps: GPSCoord; severity: string }[];
  sendCommand: (cmd: object) => void;
}

export function DashboardPage({
  telemetry,
  latestDetection,
  alerts,
  flightPath,
  hotspots,
  sendCommand,
}: Props) {
  const { toggleFeedPaused, setCameraMode, feedPaused } = useDashboardStore();

  const handleTogglePause = () => {
    toggleFeedPaused();
    sendCommand({ command: feedPaused ? "resume_feed" : "pause_feed" });
  };

  const handleSwitchCamera = (mode: "thermal" | "rgb") => {
    setCameraMode(mode);
    sendCommand({ command: "set_camera_mode", mode });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Left column */}
      <div className="flex flex-col gap-4">
        <LiveFeed
          detection={latestDetection}
          onTogglePause={handleTogglePause}
          onSwitchCamera={handleSwitchCamera}
        />
        <MapView
          dronePosition={telemetry?.gps ?? null}
          flightPath={flightPath}
          hotspots={hotspots}
        />
        <DetectionPanel />
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-4">
        <MissionControl />
        <AlertPanel alerts={alerts} />
        <StatusBar telemetry={telemetry} />
      </div>
    </div>
  );
}
