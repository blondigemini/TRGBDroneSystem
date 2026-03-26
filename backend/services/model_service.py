from pathlib import Path
from io import BytesIO

from schemas.detection import DetectionResult
from services.mock_detector import MockDetectorService


class ModelService:
    def __init__(self, model_path: str | None = None):
        self.model = None
        self.mock = MockDetectorService()

        if model_path and Path(model_path).exists():
            try:
                import tensorflow as tf
                self.model = tf.keras.models.load_model(model_path)
            except Exception:
                pass

    def predict(self, image_bytes: bytes) -> DetectionResult:
        if self.model is None:
            return self.mock.get_detection()

        import numpy as np
        from PIL import Image

        img = Image.open(BytesIO(image_bytes)).convert("RGB").resize((224, 224))
        arr = np.array(img, dtype=np.float32) / 255.0
        arr = np.expand_dims(arr, axis=0)
        pred = float(self.model.predict(arr, verbose=0)[0][0])

        from datetime import datetime, timezone
        from schemas.detection import BoundingBox

        classification = "fire" if pred > 0.5 else "no_fire"
        confidence = pred if pred > 0.5 else 1 - pred

        if confidence > 0.9:
            severity = "critical"
        elif confidence > 0.75:
            severity = "high"
        elif confidence > 0.5:
            severity = "medium"
        else:
            severity = "low"

        hotspots = []
        if classification == "fire":
            hotspots = [BoundingBox(x=0.3, y=0.3, width=0.4, height=0.4)]

        return DetectionResult(
            timestamp=datetime.now(timezone.utc),
            image_id="uploaded",
            model_type="rgb",
            classification=classification,
            confidence=round(confidence, 3),
            severity=severity,
            hotspots=hotspots,
            image_url="",
        )
