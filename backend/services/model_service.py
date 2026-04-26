# services/model_service.py
import logging
from pathlib import Path
from io import BytesIO
from datetime import datetime, timezone

from schemas.detection import DetectionResult, BoundingBox
from services.mock_detector import MockDetectorService

logger = logging.getLogger("fire-api")

CNN_THRESHOLD = 0.35


class ModelService:
    def __init__(self, model_path: str | None = None):
        self.model      = None
        self.yolo_model = None
        self.mock       = MockDetectorService()

        if model_path and Path(model_path).exists():
            try:
                import tensorflow as tf
                self.model = tf.keras.models.load_model(model_path)
                logger.info(f"CNN loaded from {model_path}")
            except Exception as e:
                logger.warning(f"CNN load failed: {e} — falling back to mock")

        self._load_yolo()

    def _load_yolo(self):
        try:
            from ultralytics import YOLO
            yolo_path = Path(__file__).resolve().parent.parent / "yolo11n.pt"
            self.yolo_model = YOLO(str(yolo_path))
            logger.info("YOLOv11n loaded.")
        except ImportError:
            logger.warning("ultralytics not installed — YOLO disabled. Run: pip install ultralytics")
        except Exception as e:
            logger.warning(f"YOLO load failed: {e}")

    def _run_cnn(self, image_bytes: bytes) -> tuple[str, float]:
        """
        IMPORTANT — class mapping:
          fire_hotspot=0, no_hotspot=1 (alphabetical Keras assignment)
          sigmoid output = P(no_hotspot)
          pred < CNN_THRESHOLD  -> fire_hotspot
          pred >= CNN_THRESHOLD -> no_hotspot
        DO NOT divide image by 255 — EfficientNetB0 has internal rescaling.
        """
        import numpy as np
        from PIL import Image

        img = Image.open(BytesIO(image_bytes)).convert("RGB").resize((224, 224))
        arr = np.array(img, dtype=np.float32)
        # NO division by 255 — EfficientNetB0 preprocesses internally
        arr = np.expand_dims(arr, axis=0)
        pred = float(self.model.predict(arr, verbose=0)[0][0])

        if pred < CNN_THRESHOLD:
            return "fire_hotspot", round(1.0 - pred, 3)
        else:
            return "no_hotspot", round(pred, 3)

    def _run_yolo(self, image_bytes: bytes) -> list[BoundingBox]:
        if self.yolo_model is None:
            return []
        import numpy as np
        from PIL import Image

        img  = Image.open(BytesIO(image_bytes)).convert("RGB")
        w, h = img.size
        results = self.yolo_model.predict(
            source=np.array(img), conf=0.30, iou=0.45, imgsz=640, verbose=False
        )
        boxes = []
        result = results[0]
        if result.boxes is not None:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                boxes.append(BoundingBox(
                    x=round(x1/w, 4), y=round(y1/h, 4),
                    width=round((x2-x1)/w, 4), height=round((y2-y1)/h, 4),
                ))
        return boxes

    @staticmethod
    def _get_severity(classification: str, confidence: float) -> str:
        if classification != "fire_hotspot":
            return "none"
        if confidence >= 0.80:
            return "high"
        elif confidence >= 0.55:
            return "medium"
        else:
            return "low"

    def predict(self, image_bytes: bytes) -> DetectionResult:
        """CNN-only — keeps existing /api/inference/predict working."""
        if self.model is None:
            return self.mock.get_detection()
        classification, confidence = self._run_cnn(image_bytes)
        severity = self._get_severity(classification, confidence)
        hotspots = [BoundingBox(x=0.3, y=0.3, width=0.4, height=0.4)] if classification == "fire_hotspot" else []
        return DetectionResult(
            timestamp=datetime.now(timezone.utc), image_id="uploaded",
            model_type="cnn", classification=classification,
            confidence=confidence, severity=severity,
            hotspots=hotspots, image_url="",
        )

    def predict_full(self, image_bytes: bytes) -> dict:
        """CNN + YOLO + fusion for /api/inference/predict/full."""
        if self.model is None:
            mock = self.mock.get_detection()
            return {
                "cnn": mock.dict(),
                "yolo": {"hotspot_detected": False, "boxes": [], "n_detections": 0},
                "fusion": {"clearance_status": "CLEARED", "risk_level": "NONE",
                           "fused_confidence": 0.0, "agreement": "MOCK_MODE"},
            }

        classification, confidence = self._run_cnn(image_bytes)
        yolo_boxes = self._run_yolo(image_bytes)
        cnn_fire   = classification == "fire_hotspot"
        yolo_fire  = len(yolo_boxes) > 0

        if cnn_fire and yolo_fire:
            clearance_status = "NOT_CLEARED"
            agreement        = "BOTH_DETECT_HOTSPOT"
            fused_conf       = max(confidence, 0.80)
            risk_level       = "HIGH" if fused_conf >= 0.75 else "MODERATE"
        elif cnn_fire and not yolo_fire:
            clearance_status = "NOT_CLEARED"
            agreement        = "CNN_ONLY"
            fused_conf       = confidence
            risk_level       = "MODERATE"
        elif not cnn_fire and yolo_fire:
            clearance_status = "FLAGGED"
            agreement        = "YOLO_ONLY"
            fused_conf       = 0.5
            risk_level       = "LOW"
        else:
            clearance_status = "CLEARED"
            agreement        = "BOTH_CLEAR"
            fused_conf       = 0.0
            risk_level       = "NONE"

        severity   = self._get_severity(classification, confidence)
        cnn_result = DetectionResult(
            timestamp=datetime.now(timezone.utc), image_id="uploaded",
            model_type="cnn+yolo", classification=classification,
            confidence=confidence, severity=severity,
            hotspots=yolo_boxes if yolo_boxes else (
                [BoundingBox(x=0.3, y=0.3, width=0.4, height=0.4)] if cnn_fire else []
            ),
            image_url="",
        )
        return {
            "cnn": cnn_result.dict(),
            "yolo": {"hotspot_detected": yolo_fire, "boxes": [b.dict() for b in yolo_boxes], "n_detections": len(yolo_boxes)},
            "fusion": {"clearance_status": clearance_status, "risk_level": risk_level,
                       "fused_confidence": round(fused_conf, 3), "agreement": agreement},
        }
