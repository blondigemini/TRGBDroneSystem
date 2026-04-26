# routers/inference.py
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel

from schemas.detection import DetectionResult
from services.model_service import ModelService
import config

router = APIRouter()
model_service = ModelService(model_path=config.MODEL_PATH)


@router.post("/predict", response_model=DetectionResult)
async def predict(file: UploadFile = File(...)):
    """CNN-only — existing endpoint, unchanged."""
    image_bytes = await file.read()
    return model_service.predict(image_bytes)


class FullPipelineResponse(BaseModel):
    cnn:    dict
    yolo:   dict
    fusion: dict


@router.post("/predict/full", response_model=FullPipelineResponse)
async def predict_full(file: UploadFile = File(...)):
    """
    Full post-fire pipeline: CNN + YOLO + fusion clearance decision.
    Returns: cnn result, yolo boxes, fusion clearance decision.
    """
    image_bytes = await file.read()
    full_result = model_service.predict_full(image_bytes)

    return FullPipelineResponse(
        cnn    = full_result["cnn"],
        yolo   = full_result["yolo"],
        fusion = full_result["fusion"],
    )
