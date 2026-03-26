import { useDashboardStore } from "../../stores/dashboardStore";

export function ConnectionDot() {
  const connected = useDashboardStore((s) => s.wsConnected);
  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-[var(--color-success)] shadow-[0_0_6px_var(--color-success)]" : "bg-red-500 shadow-[0_0_6px_#ef4444]"}`}
      />
      <span className="text-[var(--color-text-muted)]">
        {connected ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
}
