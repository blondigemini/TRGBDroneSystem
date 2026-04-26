import { useState } from "react";
import { Play, Square } from "lucide-react";
import { Card } from "../common/Card";
import { useMissions } from "../../hooks/useMissions";
import { useDashboardStore } from "../../stores/dashboardStore";

export function MissionControl() {
  const { missions, create, start, stop } = useMissions();
  const setActiveMission = useDashboardStore((s) => s.setActiveMission);

  const [name, setName] = useState("");
  const [area, setArea] = useState("Lusail, Lusail");
  const [cameraMode, setCameraMode] = useState("thermal");

  const activeMission = missions.find((m) => m.status === "active");

  const handleCreate = () => {
    if (!name.trim()) return;
    create(
      { name: name.trim(), area_name: area.trim() || "Lusail", waypoints: [], camera_mode: cameraMode },
      {
        onSuccess: (mission) => {
          start(mission.id);
          setActiveMission(mission.id);
          setName("");
          setArea("");
        },
      }
    );
  };

  const handleStop = () => {
    if (activeMission) {
      stop(activeMission.id);
      setActiveMission(null);
    }
  };

  return (
    <Card title="Mission Control">
      {activeMission ? (
        <div>
          <div className="mb-3 rounded-md bg-[var(--color-accent)]/10 p-3 border border-[var(--color-accent)]/30">
            <div className="text-sm font-semibold text-[var(--color-accent)]">
              Active: {activeMission.name}
            </div>
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">
              Area: {activeMission.area_name} | Detections:{" "}
              {activeMission.detections_count} | Alerts:{" "}
              {activeMission.alerts_count}
            </div>
          </div>
          <button
            onClick={handleStop}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition-colors"
          >
            <Square size={16} />
            Stop Mission
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mission name"
            className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface-alt)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)]"
          />
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Area name (e.g. Lusail Marina)"
            className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface-alt)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)]"
          />
          <select
            value={cameraMode}
            onChange={(e) => setCameraMode(e.target.value)}
            className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface-alt)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
          >
            <option value="thermal">Thermal</option>
            <option value="rgb">RGB</option>
          </select>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-colors"
          >
            <Play size={16} />
            Start Mission
          </button>
        </div>
      )}
    </Card>
  );
}
