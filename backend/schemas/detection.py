from datetime import datetime
from pydantic import BaseModel


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class DetectionResult(BaseModel):
    timestamp: datetime
    image_id: str
    model_type: str  # "thermal" | "rgb" | "fusion"
    classification: str  # "fire" | "no_fire"
    confidence: float
    severity: str  # "critical" | "high" | "medium" | "low"
    hotspots: list[BoundingBox]
    image_url: str
