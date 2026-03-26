from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ASSETS_DIR = BASE_DIR / "assets"
SAMPLE_IMAGES_DIR = ASSETS_DIR / "sample_images"
MODELS_DIR = BASE_DIR / "models"

# Set to a .h5 file path to enable real model inference; None = mock mode
MODEL_PATH: str | None = None

# "mock" or "real"
DRONE_MODE = "mock"

# WebSocket tick interval in seconds
WS_TICK_INTERVAL = 1.5

# Detection interval (every Nth tick)
DETECTION_EVERY_N_TICKS = 4

# Drone start location (Lusail, Qatar)
DRONE_CENTER_LAT = 25.3548
DRONE_CENTER_LNG = 51.4382

# CORS
FRONTEND_URL = "http://localhost:5173"
