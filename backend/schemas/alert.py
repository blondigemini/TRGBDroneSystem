from datetime import datetime
from enum import Enum
from pydantic import BaseModel
from .telemetry import GPSCoord
from .detection import DetectionResult


class AlertSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Alert(BaseModel):
    id: str
    timestamp: datetime
    severity: AlertSeverity
    message: str
    gps: GPSCoord
    detection: DetectionResult
    acknowledged: bool = False
    mission_id: str | None = None


class AlertStats(BaseModel):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    total: int = 0
