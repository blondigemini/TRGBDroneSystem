import random
import uuid
from datetime import datetime, timezone
from pathlib import Path

from schemas.detection import DetectionResult, BoundingBox
import config


def _compute_severity(confidence: float) -> str:
    if confidence > 0.9:
        return "critical"
    elif confidence > 0.75:
        return "high"
    elif confidence > 0.5:
        return "medium"
    return "low"


class MockDetectorService:
    def __init__(self):
        self.image_dir = config.SAMPLE_IMAGES_DIR
        self.fire_images: list[str] = []
        self.nofire_images: list[str] = []
        self._load_images()
        self.index = 0

    def _load_images(self):
        if self.image_dir.exists():
            for f in sorted(self.image_dir.iterdir()):
                if f.suffix.lower() in (".jpg", ".jpeg", ".png"):
                    if "fire" in f.stem and "no_fire" not in f.stem:
                        self.fire_images.append(f.name)
                    elif "no_fire" in f.stem:
                        self.nofire_images.append(f.name)

        # Fallback placeholder names if no images copied yet
        if not self.fire_images:
            self.fire_images = [f"fire_test_{i}.jpg" for i in range(10)]
        if not self.nofire_images:
            self.nofire_images = [f"no_fire_test_{i}.jpg" for i in range(10)]

    def get_detection(self) -> DetectionResult:
        self.index += 1
        is_fire = random.random() < 0.6

        if is_fire:
            image_name = self.fire_images[self.index % len(self.fire_images)]
            confidence = round(random.uniform(0.55, 0.98), 3)
            num_boxes = random.randint(1, 3)
            hotspots = [
                BoundingBox(
                    x=round(random.uniform(0.15, 0.55), 3),
                    y=round(random.uniform(0.15, 0.55), 3),
                    width=round(random.uniform(0.1, 0.3), 3),
                    height=round(random.uniform(0.1, 0.3), 3),
                )
                for _ in range(num_boxes)
            ]
            classification = "fire"
        else:
            image_name = self.nofire_images[self.index % len(self.nofire_images)]
            confidence = round(random.uniform(0.02, 0.25), 3)
            hotspots = []
            classification = "no_fire"

        image_id = image_name
        return DetectionResult(
            timestamp=datetime.now(timezone.utc),
            image_id=image_id,
            model_type="thermal",
            classification=classification,
            confidence=confidence,
            severity=_compute_severity(confidence),
            hotspots=hotspots,
            image_url=f"/api/images/{image_name}",
        )
