import { clsx } from "clsx";

export function Card({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4",
        className
      )}
    >
      {title && (
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
