# Fire Detection API — Backend

FastAPI backend serving 5 trained fire detection models for the AI-Powered Emergency Response Drone System.

## Models

| Endpoint | Model | Input | Threshold |
|---|---|---|---|
| `/predict/model1` | Custom CNN (FLAME 1 RGB) | Single RGB image | 0.35 |
| `/predict/model2` | EfficientNetB0 (FLAME 1 RGB) | Single RGB image | 0.50 |
| `/predict/model3` | EfficientNetB0 (FLAME 3 Thermal) | Single grayscale/thermal image | 0.50 |
| `/predict/model4` | YOLOv11n (Fire Detection) | Single RGB image (any size) | — |
| `/predict/model5` | Dual EfficientNetB0 Fusion | Two files: `rgb_file` + `nir_file` | 0.7158 |
| `/predict/all` | Models 1–3 in parallel | Single image | — |

## Setup

```bash
cd backend
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

## Test

```bash
python test_api.py
```

Or test with curl:

### Health check

```bash
curl http://localhost:8000/health
```

### Model 1 — Custom CNN

```bash
curl -X POST http://localhost:8000/predict/model1 \
  -F "file=@sample_images/test.jpg"
```

### Model 2 — EfficientNetB0

```bash
curl -X POST http://localhost:8000/predict/model2 \
  -F "file=@sample_images/test.jpg"
```

### Model 3 — Thermal (grayscale input)

```bash
curl -X POST http://localhost:8000/predict/model3 \
  -F "file=@sample_images/thermal.jpg"
```

### Model 4 — YOLO

```bash
curl -X POST http://localhost:8000/predict/model4 \
  -F "file=@sample_images/test.jpg"
```

### Model 5 — Fusion (two files required)

```bash
curl -X POST http://localhost:8000/predict/model5 \
  -F "rgb_file=@sample_images/rgb.jpg" \
  -F "nir_file=@sample_images/nir.jpg"
```

### All Models 1–3 in parallel

```bash
curl -X POST http://localhost:8000/predict/all \
  -F "file=@sample_images/test.jpg"
```

## Response Format

### Models 1–3, 5 (binary classification)

```json
{
  "model": "Model 1 — Custom CNN (FLAME 1 RGB)",
  "label": "Fire",
  "probability": 0.87,
  "threshold": 0.35,
  "confidence": "High",
  "prediction_time_ms": 142.5
}
```

### Model 4 (YOLO object detection)

```json
{
  "model": "Model 4 — YOLOv11n (Fire Detection)",
  "label": "Fire Detected",
  "detections": [
    { "box": [120.3, 45.1, 280.7, 190.2], "confidence": 0.91 }
  ],
  "annotated_image": "<base64 JPEG>",
  "count": 1,
  "prediction_time_ms": 85.3
}
```

### Confidence levels

- **High**: probability differs from threshold by > 0.3
- **Medium**: differs by 0.15–0.3
- **Low**: differs by < 0.15
