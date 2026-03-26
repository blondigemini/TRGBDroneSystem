import { Battery, Navigation, Gauge, MapPin, Signal } from "lucide-react";
import type { DroneTelemetry } from "../../types/telemetry";
import { TelemetryGauge } from "./TelemetryGauge";
import { formatCoord } from "../../utils/formatters";

export function StatusBar({ telemetry }: { telemetry: DroneTelemetry | null }) {
  if (!telemetry) {
    return (
      <div className="flex items-center justify-center py-4 text-sm text-[var(--color-text-muted)]">
        Waiting for telemetry...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      <TelemetryGauge
        label="Battery"
        value={telemetry.battery_pct}
        unit="%"
        icon={<Battery size={16} />}
        alert={telemetry.battery_pct < 20}
      />
      <TelemetryGauge
        label="Altitude"
        value={telemetry.altitude_m.toFixed(1)}
        unit="m"
        icon={<Navigation size={16} />}
      />
      <TelemetryGauge
        label="Speed"
        value={telemetry.speed_mps.toFixed(1)}
        unit="m/s"
        icon={<Gauge size={16} />}
      />
      <TelemetryGauge
        label="GPS"
        value={formatCoord(telemetry.gps.lat, telemetry.gps.lng)}
        icon={<MapPin size={16} />}
      />
      <TelemetryGauge
        label="Signal"
        value={telemetry.signal_strength}
        unit="%"
        icon={<Signal size={16} />}
        alert={telemetry.signal_strength < 50}
      />
      <TelemetryGauge
        label="Camera"
        value={telemetry.camera_mode.toUpperCase()}
        icon={<Gauge size={16} />}
      />
    </div>
  );
}
