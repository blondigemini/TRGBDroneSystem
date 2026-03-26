from datetime import datetime
from pydantic import BaseModel


class GPSCoord(BaseModel):
    lat: float
    lng: float


class DroneTelemetry(BaseModel):
    timestamp: datetime
    gps: GPSCoord
    altitude_m: float
    speed_mps: float
    heading_deg: float
    battery_pct: int
    signal_strength: int
    camera_mode: str  # "thermal" | "rgb"
