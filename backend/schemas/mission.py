from datetime import datetime
from enum import Enum
from pydantic import BaseModel
from .telemetry import GPSCoord


class MissionStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ABORTED = "aborted"


class Waypoint(BaseModel):
    lat: float
    lng: float
    altitude_m: float


class MissionCreate(BaseModel):
    name: str
    area_name: str
    waypoints: list[Waypoint] = []
    camera_mode: str = "thermal"


class Mission(BaseModel):
    id: str
    name: str
    area_name: str
    waypoints: list[Waypoint]
    camera_mode: str
    status: MissionStatus
    created_at: datetime
    started_at: datetime | None = None
    ended_at: datetime | None = None
    detections_count: int = 0
    alerts_count: int = 0
    distance_km: float = 0.0
    flight_path_actual: list[GPSCoord] = []
