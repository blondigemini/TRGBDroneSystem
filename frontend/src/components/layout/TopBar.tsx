import { Flame, Volume2, VolumeX } from "lucide-react";
import { ConnectionDot } from "../status/ConnectionDot";
import { useDashboardStore } from "../../stores/dashboardStore";
import type { DroneTelemetry } from "../../types/telemetry";

export function TopBar({ telemetry }: { telemetry: DroneTelemetry | null }) {
  const { audioEnabled, toggleAudio } = useDashboardStore();

  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3">
      <div className="flex items-center gap-3">
        <Flame size={24} className="text-[var(--color-accent)]" />
        <div>
          <h1 className="text-base font-bold text-[var(--color-text-primary)]">
            TRGB Drone System
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            AI-Thermal Fire Detection Dashboard
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {telemetry && (
          <div className="flex items-center gap-2 rounded-md bg-[var(--color-bg-surface-alt)] px-3 py-1.5">
            <span
              className={`text-sm font-bold ${telemetry.battery_pct < 20 ? "text-red-400" : "text-[var(--color-success)]"}`}
            >
              {telemetry.battery_pct}%
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">Battery</span>
          </div>
        )}

        <button
          onClick={toggleAudio}
          className="rounded-md p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-alt)] transition-colors"
          title={audioEnabled ? "Mute alerts" : "Unmute alerts"}
        >
          {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>

        <ConnectionDot />

        <div className="text-sm text-[var(--color-text-muted)]">
          {new Date().toLocaleTimeString()}
        </div>
      </div>
    </header>
  );
}
