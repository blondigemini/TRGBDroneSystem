import { clsx } from "clsx";
import { SEVERITY_BG } from "../../utils/constants";

export function Badge({
  severity,
  children,
}: {
  severity: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase",
        SEVERITY_BG[severity] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30"
      )}
    >
      {children}
    </span>
  );
}
