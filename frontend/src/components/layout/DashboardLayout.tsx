import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import type { DroneTelemetry } from "../../types/telemetry";

export function DashboardLayout({
  telemetry,
}: {
  telemetry: DroneTelemetry | null;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar telemetry={telemetry} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
