from fastapi import APIRouter, UploadFile, File

from schemas.detection import DetectionResult
from services.model_service import ModelService
import config

router = APIRouter()

model_service = ModelService(model_path=config.MODEL_PATH)


@router.post("/predict", response_model=DetectionResult)
async def predict(file: UploadFile = File(...)):
    image_bytes = await file.read()
    result = model_service.predict(image_bytes)
    return result
