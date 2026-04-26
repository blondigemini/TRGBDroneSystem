# backend/main.py — FastAPI app serving 5 fire-detection models
import asyncio
import base64
import logging
import time
from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

from security import verify_frame

# ─── Configuration ────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"

MODEL_FILES = {
    "model1": MODELS_DIR / "model1_cnn.h5",
    "model2": MODELS_DIR / "model2_efficientnet.keras",
    "model3": MODELS_DIR / "model3_thermal.keras",
    "model4": MODELS_DIR / "model4_yolo.pt",
    "model5": MODELS_DIR / "model5_fusion.keras",
}

MODEL_NAMES = {
    "model1": "Model 1 — Custom CNN (FLAME 1 RGB)",
    "model2": "Model 2 — EfficientNetB0 (FLAME 1 RGB)",
    "model3": "Model 3 — EfficientNetB0 (FLAME 3 Thermal)",
    "model4": "Model 4 — YOLOv11n (Fire Detection)",
    "model5": "Model 5 — Dual EfficientNetB0 Fusion (RGB + NIR)",
}

THRESHOLDS = {
    "model1": 0.35,
    "model2": 0.50,
    "model3": 0.50,
    "model5": 0.2468,
}

logger = logging.getLogger("fire-api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")


# ─── Response schemas ─────────────────────────────────────────────────────────

class TamperEvent(BaseModel):
    code: str
    detail: str


class SecurityAssessment(BaseModel):
    status: str          # "OK" | "UNSIGNED" | "HASH_MISMATCH" | "SIGNATURE_INVALID" | "CHAIN_BROKEN"
    frame_hash: str
    tamper_event: TamperEvent | None = None


class PredictionResponse(BaseModel):
    model: str
    label: str
    probability: float
    threshold: float
    confidence: str
    prediction_time_ms: float
    security: SecurityAssessment | None = None


class YOLODetection(BaseModel):
    box: list[float]
    confidence: float


class YOLOResponse(BaseModel):
    model: str
    label: str
    detections: list[YOLODetection]
    annotated_image: str
    count: int
    prediction_time_ms: float
    security: SecurityAssessment | None = None


class AllModelsResponse(BaseModel):
    model1: PredictionResponse | None = None
    model2: PredictionResponse | None = None
    model3: PredictionResponse | None = None
    security: SecurityAssessment | None = None


class HealthResponse(BaseModel):
    status: str
    models: dict[str, bool]


class ThermalConversionResponse(BaseModel):
    grayscale_image: str   # base64 JPEG — model-compatible grayscale
    colormap_image: str    # base64 JPEG — visual thermal preview (INFERNO)
    processing_time_ms: float


# ─── Image preprocessing helpers ─────────────────────────────────────────────
def read_image_from_upload(file_bytes: bytes, target_size: tuple[int, int] = (224, 224)) -> Image.Image:
    """Read uploaded bytes into a PIL Image, resized to target_size."""
    img = Image.open(BytesIO(file_bytes)).convert("RGB")
    img = img.resize(target_size, Image.LANCZOS)
    return img


def preprocess_for_model1(img: Image.Image) -> np.ndarray:
    """Model 1: rescale [0,255] -> [0,1], shape (1,224,224,3)."""
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)


def preprocess_for_model2(img: Image.Image) -> np.ndarray:
    """Model 2: raw [0,255], shape (1,224,224,3)."""
    arr = np.array(img, dtype=np.float32)
    return np.expand_dims(arr, axis=0)


def preprocess_for_model3(file_bytes: bytes) -> np.ndarray:
    """Model 3 (thermal): grayscale -> 3-channel repeat, raw [0,255], shape (1,224,224,3)."""
    img = Image.open(BytesIO(file_bytes)).convert("L")
    img = img.resize((224, 224), Image.LANCZOS)
    gray = np.array(img, dtype=np.float32)
    three_ch = np.stack([gray, gray, gray], axis=-1)
    return np.expand_dims(three_ch, axis=0)


def preprocess_for_model5_rgb(file_bytes: bytes) -> np.ndarray:
    """Model 5 RGB branch: raw [0,255], shape (1,224,224,3)."""
    img = read_image_from_upload(file_bytes)
    arr = np.array(img, dtype=np.float32)
    return np.expand_dims(arr, axis=0)


def preprocess_for_model5_nir(file_bytes: bytes) -> np.ndarray:
    """Model 5 NIR branch: grayscale -> 3-channel repeat, raw [0,255], shape (1,224,224,3)."""
    img = Image.open(BytesIO(file_bytes)).convert("L")
    img = img.resize((224, 224), Image.LANCZOS)
    gray = np.array(img, dtype=np.float32)
    three_ch = np.stack([gray, gray, gray], axis=-1)
    return np.expand_dims(three_ch, axis=0)


# ─── Confidence level helper ─────────────────────────────────────────────────
def get_confidence_level(probability: float, threshold: float) -> str:
    """
    High   = probability differs from threshold by > 0.3
    Medium = 0.15–0.3
    Low    = < 0.15
    """
    diff = abs(probability - threshold)
    if diff > 0.3:
        return "High"
    elif diff >= 0.15:
        return "Medium"
    else:
        return "Low"


# ─── FusionModel class (required for model5 deserialization) ─────────────────
import keras
import tensorflow as tf


@keras.saving.register_keras_serializable()
class FusionModel(keras.Model):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.rgb_backbone = keras.applications.EfficientNetB0(
            include_top=False, weights=None, pooling='avg'
        )
        self.nir_backbone = keras.applications.EfficientNetB0(
            include_top=False, weights=None, pooling='avg'
        )
        self.dense1 = keras.layers.Dense(512, activation='relu')
        self.bn1    = keras.layers.BatchNormalization()
        self.drop1  = keras.layers.Dropout(0.5)
        self.dense2 = keras.layers.Dense(256, activation='relu')
        self.bn2    = keras.layers.BatchNormalization()
        self.drop2  = keras.layers.Dropout(0.4)
        self.output_layer = keras.layers.Dense(1, activation='sigmoid')

    def call(self, inputs, training=False):
        rgb, nir = inputs
        rgb_features = self.rgb_backbone(rgb, training=training)
        nir_features = self.nir_backbone(nir, training=training)
        x = tf.concat([rgb_features, nir_features], axis=-1)
        x = self.dense1(x)
        x = self.bn1(x, training=training)
        x = self.drop1(x, training=training)
        x = self.dense2(x)
        x = self.bn2(x, training=training)
        x = self.drop2(x, training=training)
        return self.output_layer(x)


# ─── Model loading (lifespan) ────────────────────────────────────────────────
models: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all models once at startup. If a model file fails, set it to None."""
    global models

    # --- Keras models (1, 2, 3) — standard load ---
    for key in ["model1", "model2", "model3"]:
        path = MODEL_FILES[key]
        if not path.exists():
            logger.warning(f"[{key}] file not found: {path}")
            models[key] = None
            continue
        try:
            models[key] = keras.models.load_model(str(path), compile=False)
            logger.info(f"[{key}] loaded successfully from {path}")
        except Exception as e:
            logger.error(f"[{key}] load failed: {e}")
            models[key] = None

    # --- Model 5 — subclassed FusionModel, needs custom_objects ---
    path5 = MODEL_FILES["model5"]
    if not path5.exists():
        logger.warning(f"[model5] file not found: {path5}")
        models["model5"] = None
    else:
        try:
            models["model5"] = keras.models.load_model(
                str(path5),
                custom_objects={"FusionModel": FusionModel},
                compile=False,
            )
            logger.info(f"[model5] loaded successfully from {path5}")
        except Exception as e:
            logger.error(f"[model5] load failed: {e}")
            models["model5"] = None

    # --- YOLO model (4) ---
    path4 = MODEL_FILES["model4"]
    if not path4.exists():
        logger.warning(f"[model4] file not found: {path4}")
        models["model4"] = None
    else:
        try:
            from ultralytics import YOLO
            models["model4"] = YOLO(str(path4))
            logger.info(f"[model4] loaded successfully from {path4}")
        except Exception as e:
            logger.error(f"[model4] load failed: {e}")
            models["model4"] = None

    loaded = [k for k, v in models.items() if v is not None]
    logger.info(f"Startup complete — loaded models: {loaded}")

    # --- Warmup inference to trigger JIT/graph compilation ---
    dummy = np.zeros((1, 224, 224, 3), dtype=np.float32)
    if models.get("model1") is not None:
        models["model1"].predict(dummy, verbose=0)
    if models.get("model2") is not None:
        models["model2"].predict(dummy, verbose=0)
    if models.get("model3") is not None:
        models["model3"].predict(dummy, verbose=0)
    if models.get("model5") is not None:
        models["model5"].predict([dummy, dummy], verbose=0)
    logger.info("Warmup complete — models ready.")

    # --- Dashboard services ---
    try:
        from services.mock_drone import MockDroneService
        from services.mock_detector import MockDetectorService
        from services.mission_store import MissionStore
        from services.alert_manager import AlertManager
        app.state.drone_service = MockDroneService()
        app.state.detector_service = MockDetectorService()
        app.state.mission_store = MissionStore()
        app.state.alert_manager = AlertManager()
        logger.info("Dashboard services initialised.")
    except Exception as e:
        logger.warning(f"Dashboard services not initialised: {e}")

    yield

    models.clear()
    logger.info("Shutdown — models released.")


# ─── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="Fire Detection API — AI Drone System",
    description="Serves predictions from 5 trained fire detection models for the AI-Powered Emergency Response Drone System.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health endpoint ──────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health():
    return HealthResponse(
        status="ok",
        models={k: (v is not None) for k, v in models.items()},
    )


# ─── Security verification helper ─────────────────────────────────────────────

def _verify(image_bytes: bytes, signature: str | None = None) -> SecurityAssessment:
    """Run HMAC-SHA256 frame verification and return a SecurityAssessment object.

    Parameters
    ----------
    image_bytes : bytes
        Raw uploaded image bytes.
    signature : str | None
        Optional hex-encoded HMAC-SHA256 signature submitted alongside the image.
    """
    # Normalise: Swagger sends "" for a blank optional text field, treat as None
    if signature is not None and signature.strip() == "":
        signature = None

    result = verify_frame(image_bytes, signature=signature)
    tamper = None
    if result["tamper_event"] is not None:
        tamper = TamperEvent(**result["tamper_event"])
    return SecurityAssessment(
        status=result["status"],
        frame_hash=result["frame_hash"],
        tamper_event=tamper,
    )


def _is_tampered(sec: SecurityAssessment) -> bool:
    """Return True if the security status represents a tamper event."""
    return sec.status in ("HASH_MISMATCH", "SIGNATURE_INVALID", "CHAIN_BROKEN")


# ─── Helper: run a Keras binary classification model ─────────────────────────
def _predict_keras(model_key: str, input_array: np.ndarray) -> PredictionResponse:
    model = models.get(model_key)
    if model is None:
        raise HTTPException(status_code=503, detail=f"{model_key} is not loaded.")

    threshold = THRESHOLDS[model_key]
    start = time.perf_counter()
    pred = float(model.predict(input_array, verbose=0)[0][0])
    elapsed_ms = round((time.perf_counter() - start) * 1000, 1)

    probability = round(pred, 4)
    label = "Fire" if probability >= threshold else "No Fire"
    confidence = get_confidence_level(probability, threshold)

    logger.info(f"[{model_key}] prob={probability:.4f} threshold={threshold} label={label} confidence={confidence} time={elapsed_ms}ms")

    return PredictionResponse(
        model=MODEL_NAMES[model_key],
        label=label,
        probability=probability,
        threshold=threshold,
        confidence=confidence,
        prediction_time_ms=elapsed_ms,
    )


# ─── POST /predict/model1 ────────────────────────────────────────────────────
@app.post("/predict/model1", response_model=PredictionResponse, tags=["predictions"])
async def predict_model1(file: UploadFile = File(...), signature: str | None = Form(None)):
    """
    **Model 1 — Custom CNN (FLAME 1 RGB)**

    Accepts a single RGB image. Preprocessing: resize to 224×224, rescale to [0,1].
    Decision threshold: 0.35 (fire-biased).
    """
    file_bytes = await file.read()
    sec = _verify(file_bytes, signature)
    if _is_tampered(sec):
        return PredictionResponse(
            model=MODEL_NAMES["model1"], label="null", probability=0.0,
            threshold=THRESHOLDS["model1"], confidence="Low",
            prediction_time_ms=0.0, security=sec,
        )
    img = read_image_from_upload(file_bytes)
    arr = preprocess_for_model1(img)
    resp = _predict_keras("model1", arr)
    resp.security = sec
    return resp


# ─── POST /predict/model2 ────────────────────────────────────────────────────
@app.post("/predict/model2", response_model=PredictionResponse, tags=["predictions"])
async def predict_model2(file: UploadFile = File(...), signature: str | None = Form(None)):
    """
    **Model 2 — EfficientNetB0 Transfer Learning (FLAME 1 RGB)**

    Accepts a single RGB image. Preprocessing: resize to 224×224, NO rescaling (raw 0-255).
    Decision threshold: 0.5.
    """
    file_bytes = await file.read()
    sec = _verify(file_bytes, signature)
    if _is_tampered(sec):
        return PredictionResponse(
            model=MODEL_NAMES["model2"], label="null", probability=0.0,
            threshold=THRESHOLDS["model2"], confidence="Low",
            prediction_time_ms=0.0, security=sec,
        )
    img = read_image_from_upload(file_bytes)
    arr = preprocess_for_model2(img)
    resp = _predict_keras("model2", arr)
    resp.security = sec
    return resp


# ─── POST /predict/model3 ────────────────────────────────────────────────────
@app.post("/predict/model3", response_model=PredictionResponse, tags=["predictions"])
async def predict_model3(file: UploadFile = File(...), signature: str | None = Form(None)):
    """
    **Model 3 — EfficientNetB0 (FLAME 3 Thermal)**

    Accepts a single **grayscale/thermal** image (JPEG). The image is converted
    to 3-channel by repeating the grayscale values. No rescaling (raw 0-255).
    Decision threshold: 0.5.
    """
    file_bytes = await file.read()
    sec = _verify(file_bytes, signature)
    if _is_tampered(sec):
        return PredictionResponse(
            model=MODEL_NAMES["model3"], label="null", probability=0.0,
            threshold=THRESHOLDS["model3"], confidence="Low",
            prediction_time_ms=0.0, security=sec,
        )
    arr = preprocess_for_model3(file_bytes)
    resp = _predict_keras("model3", arr)
    resp.security = sec
    return resp


# ─── POST /predict/model4 ────────────────────────────────────────────────────
@app.post("/predict/model4", response_model=YOLOResponse, tags=["predictions"])
async def predict_model4(file: UploadFile = File(...), signature: str | None = Form(None)):
    """
    **Model 4 — YOLOv11n (Fire Object Detection)**

    Accepts a single RGB image of any size (YOLO handles internal resizing).
    Returns bounding boxes with confidence scores and an annotated image as base64.
    """
    model = models.get("model4")
    if model is None:
        raise HTTPException(status_code=503, detail="model4 is not loaded.")

    file_bytes = await file.read()
    sec = _verify(file_bytes, signature)
    if _is_tampered(sec):
        return YOLOResponse(
            model=MODEL_NAMES["model4"], label="null",
            detections=[], annotated_image="", count=0,
            prediction_time_ms=0.0, security=sec,
        )

    img = Image.open(BytesIO(file_bytes)).convert("RGB")
    img_np = np.array(img)

    start = time.perf_counter()
    results = model.predict(source=img_np, conf=0.25, verbose=False)
    elapsed_ms = round((time.perf_counter() - start) * 1000, 1)

    detections: list[YOLODetection] = []
    result = results[0]
    if result.boxes is not None:
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0])
            detections.append(YOLODetection(
                box=[round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                confidence=round(conf, 4),
            ))

    # Generate annotated image
    annotated = result.plot()  # BGR numpy array
    annotated_rgb = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)
    pil_annotated = Image.fromarray(annotated_rgb)
    buf = BytesIO()
    pil_annotated.save(buf, format="JPEG", quality=85)
    b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")

    count = len(detections)
    label = "Fire Detected" if count > 0 else "No Fire Detected"

    logger.info(f"[model4] detections={count} label={label} time={elapsed_ms}ms")

    return YOLOResponse(
        model=MODEL_NAMES["model4"],
        label=label,
        detections=detections,
        annotated_image=b64_str,
        count=count,
        prediction_time_ms=elapsed_ms,
        security=sec,
    )


# ─── POST /predict/model5 ────────────────────────────────────────────────────
@app.post("/predict/model5", response_model=PredictionResponse, tags=["predictions"])
async def predict_model5(
    rgb_file: UploadFile = File(...),
    nir_file: UploadFile = File(...),
    signature: str | None = Form(None),
):
    """
    **Model 5 — Dual EfficientNetB0 Fusion (RGB + NIR)**

    Requires **two** file uploads:
    - `rgb_file`: RGB image (224×224, raw 0-255)
    - `nir_file`: NIR/grayscale image (converted to 3-channel by repeating)

    Decision threshold: 0.2468.
    """
    model = models.get("model5")
    if model is None:
        raise HTTPException(status_code=503, detail="model5 is not loaded.")

    rgb_bytes = await rgb_file.read()
    nir_bytes = await nir_file.read()

    # Verify the RGB frame (primary frame for security)
    sec = _verify(rgb_bytes, signature)
    if _is_tampered(sec):
        return PredictionResponse(
            model=MODEL_NAMES["model5"], label="null", probability=0.0,
            threshold=THRESHOLDS["model5"], confidence="Low",
            prediction_time_ms=0.0, security=sec,
        )

    rgb_arr = preprocess_for_model5_rgb(rgb_bytes)
    nir_arr = preprocess_for_model5_nir(nir_bytes)

    threshold = THRESHOLDS["model5"]
    start = time.perf_counter()
    pred = float(model.predict([rgb_arr, nir_arr], verbose=0)[0][0])
    elapsed_ms = round((time.perf_counter() - start) * 1000, 1)

    probability = round(pred, 4)
    label = "Fire" if probability >= threshold else "No Fire"
    confidence = get_confidence_level(probability, threshold)

    logger.info(f"[model5] prob={probability:.4f} threshold={threshold} label={label} confidence={confidence} time={elapsed_ms}ms")

    return PredictionResponse(
        model=MODEL_NAMES["model5"],
        label=label,
        probability=probability,
        threshold=threshold,
        confidence=confidence,
        prediction_time_ms=elapsed_ms,
        security=sec,
    )


# ─── POST /predict/all — Run Models 1-3 in parallel ──────────────────────────
@app.post("/predict/all", response_model=AllModelsResponse, tags=["predictions"])
async def predict_all(file: UploadFile = File(...), signature: str | None = Form(None)):
    """
    **Run Models 1, 2, and 3 in parallel** on a single uploaded image.

    Returns results from all three models at once. Models that are not loaded
    will return null in their respective field.
    """
    file_bytes = await file.read()
    sec = _verify(file_bytes, signature)

    if _is_tampered(sec):
        return AllModelsResponse(model1=None, model2=None, model3=None, security=sec)

    img = read_image_from_upload(file_bytes)

    arr1 = preprocess_for_model1(img)
    arr2 = preprocess_for_model2(img)
    arr3 = preprocess_for_model3(file_bytes)

    loop = asyncio.get_event_loop()

    async def run_model(model_key: str, input_arr: np.ndarray) -> PredictionResponse | None:
        if models.get(model_key) is None:
            return None
        resp = await loop.run_in_executor(None, _predict_keras, model_key, input_arr)
        resp.security = sec
        return resp

    r1, r2, r3 = await asyncio.gather(
        run_model("model1", arr1),
        run_model("model2", arr2),
        run_model("model3", arr3),
    )

    return AllModelsResponse(model1=r1, model2=r2, model3=r3, security=sec)


# ─── POST /tools/rgb-to-thermal — Simulate thermal from RGB ─────────────────
@app.post("/tools/rgb-to-thermal", response_model=ThermalConversionResponse, tags=["tools"])
async def rgb_to_thermal(file: UploadFile = File(...)):
    """
    **RGB → Pseudo-Thermal Converter**

    Accepts a single RGB image and returns two versions:
    - `grayscale_image`: luminance-based grayscale (model-compatible with Model 3 / Model 5 NIR input)
    - `colormap_image`: INFERNO colormap applied for visual thermal preview

    Both are returned as base64-encoded JPEG strings.
    """
    start = time.perf_counter()
    file_bytes = await file.read()

    img = Image.open(BytesIO(file_bytes)).convert("RGB")
    img_np = np.array(img)

    # --- Simulate thermal/NIR look: bright hotspots on dark background ---
    # Convert to grayscale (luminance)
    gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)

    # Invert so bright areas (fire/heat) become white hotspots
    # and dark background stays dark after re-inversion
    inverted = cv2.bitwise_not(gray)

    # CLAHE to enhance contrast — makes hotspots pop
    clahe = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # Boost bright regions (simulate thermal hotspot glow)
    # Normalize to float, apply gamma < 1 to brighten highlights
    norm = enhanced.astype(np.float32) / 255.0
    gamma = 0.6
    thermal = np.power(norm, gamma)

    # Increase contrast: stretch the bright parts further
    thermal = np.clip((thermal - 0.3) * (1.0 / 0.7), 0, 1)
    thermal = (thermal * 255).astype(np.uint8)

    # Light Gaussian blur for the soft thermal glow effect
    thermal = cv2.GaussianBlur(thermal, (3, 3), 0)

    # Encode thermal grayscale as JPEG → base64 (model-compatible)
    gray_pil = Image.fromarray(thermal, mode="L")
    buf_gray = BytesIO()
    gray_pil.save(buf_gray, format="JPEG", quality=90)
    b64_gray = base64.b64encode(buf_gray.getvalue()).decode("utf-8")

    # --- Visual preview: same thermal image (white-hot style) ---
    # No colormap — real thermal cameras show grayscale white-hot
    buf_cm = BytesIO()
    gray_pil.save(buf_cm, format="JPEG", quality=90)
    b64_cm = base64.b64encode(buf_cm.getvalue()).decode("utf-8")

    elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
    logger.info(f"[rgb-to-thermal] conversion done in {elapsed_ms}ms")

    return ThermalConversionResponse(
        grayscale_image=b64_gray,
        colormap_image=b64_cm,
        processing_time_ms=elapsed_ms,
    )


# ─── Dashboard API routes ─────────────────────────────────────────────────────
try:
    from routers import drone, missions, alerts, inference
    from fastapi.staticfiles import StaticFiles
    import config

    # Mount sample images if directory exists
    if config.SAMPLE_IMAGES_DIR.exists():
        app.mount("/images", StaticFiles(directory=str(config.SAMPLE_IMAGES_DIR)), name="images")

    # Register dashboard routers (no /api prefix — vite proxy strips it)
    app.include_router(drone.router, prefix="/drone", tags=["drone"])
    app.include_router(missions.router, prefix="/missions", tags=["missions"])
    app.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
    app.include_router(inference.router, prefix="/inference", tags=["inference"])

    try:
        from ws import feed
        app.include_router(feed.router)
    except Exception:
        pass

    logger.info("Dashboard routers (drone/missions/alerts/inference/ws) mounted.")
except ImportError as e:
    logger.warning(f"Dashboard routers not loaded (missing modules): {e}")
except Exception as e:
    logger.warning(f"Dashboard routers not loaded: {e}")
