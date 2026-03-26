from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import config
from routers import drone, missions, alerts, inference
from ws import feed
from services.mock_drone import MockDroneService
from services.mock_detector import MockDetectorService
from services.mission_store import MissionStore
from services.alert_manager import AlertManager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize services
    app.state.drone_service = MockDroneService()
    app.state.detector_service = MockDetectorService()
    app.state.mission_store = MissionStore()
    app.state.alert_manager = AlertManager()
    yield


app = FastAPI(title="TRGB Drone Dashboard API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount sample images as static files
app.mount("/api/images", StaticFiles(directory=str(config.SAMPLE_IMAGES_DIR)), name="images")

# Register routers
app.include_router(drone.router, prefix="/api/drone", tags=["drone"])
app.include_router(missions.router, prefix="/api/missions", tags=["missions"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(inference.router, prefix="/api/inference", tags=["inference"])
app.include_router(feed.router)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "drone_mode": config.DRONE_MODE,
        "model_loaded": config.MODEL_PATH is not None,
    }
