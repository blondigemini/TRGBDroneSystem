interface Props {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  alert?: boolean;
}

export function TelemetryGauge({ label, value, unit, icon, alert }: Props) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[var(--color-bg-surface-alt)] px-3 py-2">
      <div className={alert ? "text-red-400" : "text-[var(--color-accent)]"}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
        <div className={`text-sm font-bold ${alert ? "text-red-400" : "text-[var(--color-text-primary)]"}`}>
          {value}
          {unit && <span className="ml-0.5 text-xs font-normal text-[var(--color-text-muted)]">{unit}</span>}
        </div>
      </div>
    </div>
  );
}
