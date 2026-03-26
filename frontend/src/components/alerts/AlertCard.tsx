import { MapPin, Check } from "lucide-react";
import type { Alert } from "../../types/alert";
import { Badge } from "../common/Badge";
import { timeAgo, formatCoord } from "../../utils/formatters";

interface Props {
  alert: Alert;
  onAcknowledge?: (id: string) => void;
}

export function AlertCard({ alert, onAcknowledge }: Props) {
  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        alert.acknowledged
          ? "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] opacity-60"
          : "border-[var(--color-border-default)] bg-[var(--color-bg-surface-alt)]"
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <Badge severity={alert.severity}>{alert.severity}</Badge>
        <span className="text-xs text-[var(--color-text-muted)]">
          {timeAgo(alert.timestamp)}
        </span>
      </div>
      <p className="mb-2 text-sm text-[var(--color-text-primary)]">
        {alert.message}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          <MapPin size={12} />
          {formatCoord(alert.gps.lat, alert.gps.lng)}
        </div>
        {!alert.acknowledged && onAcknowledge && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="flex items-center gap-1 rounded bg-[var(--color-bg-surface)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-success)] transition-colors"
          >
            <Check size={12} />
            Ack
          </button>
        )}
      </div>
    </div>
  );
}
