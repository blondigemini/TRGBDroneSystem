import { Routes, Route } from "react-router-dom";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { MissionsPage } from "./pages/MissionsPage";
import { ThermalToolPage } from "./pages/ThermalToolPage";
import { useDroneFeed } from "./hooks/useDroneFeed";

function App() {
  const { telemetry, latestDetection, alerts, flightPath, hotspots, sendCommand } = useDroneFeed();

  return (
    <Routes>
      <Route element={<DashboardLayout telemetry={telemetry} />}>
        <Route
          path="/"
          element={
            <DashboardPage
              telemetry={telemetry}
              latestDetection={latestDetection}
              alerts={alerts}
              flightPath={flightPath}
              hotspots={hotspots}
              sendCommand={sendCommand}
            />
          }
        />
        <Route path="/missions" element={<MissionsPage />} />
        <Route path="/thermal-tool" element={<ThermalToolPage />} />
      </Route>
    </Routes>
  );
}

export default App;
