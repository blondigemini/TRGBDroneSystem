import uuid
from datetime import datetime, timezone, timedelta

from schemas.mission import Mission, MissionCreate, MissionStatus
from schemas.telemetry import GPSCoord


def _seed_missions() -> dict[str, Mission]:
    now = datetime.now(timezone.utc)
    seeds = {}

    m1_id = str(uuid.uuid4())
    seeds[m1_id] = Mission(
        id=m1_id,
        name="Marina District Sweep",
        area_name="Lusail Marina",
        waypoints=[],
        camera_mode="thermal",
        status=MissionStatus.COMPLETED,
        created_at=now - timedelta(hours=6),
        started_at=now - timedelta(hours=6),
        ended_at=now - timedelta(hours=5, minutes=15),
        detections_count=12,
        alerts_count=3,
        distance_km=4.2,
    )

    m2_id = str(uuid.uuid4())
    seeds[m2_id] = Mission(
        id=m2_id,
        name="Stadium Perimeter Check",
        area_name="Lusail Stadium",
        waypoints=[],
        camera_mode="rgb",
        status=MissionStatus.COMPLETED,
        created_at=now - timedelta(hours=3),
        started_at=now - timedelta(hours=3),
        ended_at=now - timedelta(hours=2, minutes=30),
        detections_count=2,
        alerts_count=0,
        distance_km=2.8,
    )

    m3_id = str(uuid.uuid4())
    seeds[m3_id] = Mission(
        id=m3_id,
        name="Industrial Zone Survey",
        area_name="Ras Laffan Industrial",
        waypoints=[],
        camera_mode="thermal",
        status=MissionStatus.ABORTED,
        created_at=now - timedelta(hours=1),
        started_at=now - timedelta(hours=1),
        ended_at=now - timedelta(minutes=42),
        detections_count=8,
        alerts_count=5,
        distance_km=1.5,
    )

    return seeds


class MissionStore:
    def __init__(self):
        self.missions: dict[str, Mission] = _seed_missions()

    def create(self, data: MissionCreate) -> Mission:
        mission_id = str(uuid.uuid4())
        mission = Mission(
            id=mission_id,
            name=data.name,
            area_name=data.area_name,
            waypoints=data.waypoints,
            camera_mode=data.camera_mode,
            status=MissionStatus.PENDING,
            created_at=datetime.now(timezone.utc),
        )
        self.missions[mission_id] = mission
        return mission

    def get(self, mission_id: str) -> Mission | None:
        return self.missions.get(mission_id)

    def list_all(self) -> list[Mission]:
        return sorted(self.missions.values(), key=lambda m: m.created_at, reverse=True)

    def update_status(self, mission_id: str, status: MissionStatus) -> Mission | None:
        mission = self.missions.get(mission_id)
        if not mission:
            return None
        mission.status = status
        now = datetime.now(timezone.utc)
        if status == MissionStatus.ACTIVE:
            mission.started_at = now
        elif status in (MissionStatus.COMPLETED, MissionStatus.ABORTED):
            mission.ended_at = now
        return mission

    def record_detection(self, mission_id: str, is_alert: bool = False):
        mission = self.missions.get(mission_id)
        if mission:
            mission.detections_count += 1
            if is_alert:
                mission.alerts_count += 1
