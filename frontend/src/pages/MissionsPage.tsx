import { MissionControl } from "../components/mission/MissionControl";
import { MissionHistory } from "../components/mission/MissionHistory";

export function MissionsPage() {
  return (
    <div className="flex flex-col gap-4">
      <MissionControl />
      <MissionHistory />
    </div>
  );
}
