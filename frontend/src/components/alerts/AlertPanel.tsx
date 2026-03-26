import { useRef, useEffect } from "react";
import type { Alert } from "../../types/alert";
import { AlertCard } from "./AlertCard";
import { Card } from "../common/Card";
import { Bell } from "lucide-react";
import { acknowledgeAlert } from "../../api/alerts";
import { useDashboardStore } from "../../stores/dashboardStore";

interface Props {
  alerts: Alert[];
}

export function AlertPanel({ alerts }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const audioEnabled = useDashboardStore((s) => s.audioEnabled);
  const prevCountRef = useRef(alerts.length);

  // Play sound on new critical alert
  useEffect(() => {
    if (alerts.length > prevCountRef.current && audioEnabled) {
      const latest = alerts[0];
      if (latest?.severity === "critical") {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = "square";
        gain.gain.value = 0.1;
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    }
    prevCountRef.current = alerts.length;
  }, [alerts, audioEnabled]);

  const handleAck = async (id: string) => {
    try {
      await acknowledgeAlert(id);
    } catch {
      // ignore
    }
  };

  return (
    <Card className="flex h-full flex-col" title="Alerts">
      {alerts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-[var(--color-text-muted)]">
          <Bell size={32} className="mb-2 opacity-30" />
          <span className="text-sm">No alerts yet</span>
        </div>
      ) : (
        <div
          ref={listRef}
          className="flex flex-col gap-2 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 320px)" }}
        >
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onAcknowledge={handleAck} />
          ))}
        </div>
      )}
    </Card>
  );
}
