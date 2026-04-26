import { NavLink } from "react-router-dom";
import { LayoutDashboard, Navigation, Flame } from "lucide-react";
import { clsx } from "clsx";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/missions", icon: Navigation, label: "Missions" },
  { to: "/thermal-tool", icon: Flame, label: "Thermal" },
];

export function Sidebar() {
  return (
    <nav className="flex w-16 flex-col items-center gap-1 border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-4">
      {links.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            clsx(
              "flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10px] transition-colors",
              isActive
                ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-alt)]"
            )
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
