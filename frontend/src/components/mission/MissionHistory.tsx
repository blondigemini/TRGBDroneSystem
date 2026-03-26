import { useMissions } from "../../hooks/useMissions";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { timeAgo } from "../../utils/formatters";

const STATUS_SEVERITY: Record<string, string> = {
  active: "high",
  completed: "low",
  aborted: "critical",
  pending: "medium",
  paused: "medium",
};

export function MissionHistory() {
  const { missions, isLoading } = useMissions();

  return (
    <Card title="Mission History">
      {isLoading ? (
        <div className="py-4 text-center text-sm text-[var(--color-text-muted)]">
          Loading...
        </div>
      ) : missions.length === 0 ? (
        <div className="py-4 text-center text-sm text-[var(--color-text-muted)]">
          No missions yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-default)] text-xs text-[var(--color-text-muted)]">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Area</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Detections</th>
                <th className="pb-2 font-medium">Alerts</th>
                <th className="pb-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {missions.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-[var(--color-border-default)]/50"
                >
                  <td className="py-2 font-medium text-[var(--color-text-primary)]">
                    {m.name}
                  </td>
                  <td className="py-2 text-[var(--color-text-muted)]">
                    {m.area_name}
                  </td>
                  <td className="py-2">
                    <Badge severity={STATUS_SEVERITY[m.status] ?? "low"}>
                      {m.status}
                    </Badge>
                  </td>
                  <td className="py-2 text-[var(--color-text-muted)]">
                    {m.detections_count}
                  </td>
                  <td className="py-2 text-[var(--color-text-muted)]">
                    {m.alerts_count}
                  </td>
                  <td className="py-2 text-[var(--color-text-muted)]">
                    {timeAgo(m.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
