# TRGB Drone System

**AI-Powered Fire Detection & Post-Fire Clearance Dashboard**

A full-stack drone operations dashboard that integrates five trained fire-detection models (CNN, EfficientNetB0, YOLOv11n, and a dual-branch Fusion model) with a real-time monitoring interface. Designed for post-fire clearance missions — the system ingests live drone imagery, runs inference, generates HMAC-verified security assessments, and streams results to operators via WebSocket.

---

## Table of Contents

- [System Overview](#system-overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Backend](#backend-setup)
  - [Frontend](#frontend-setup)
  - [CNN Training Environment](#cnn-training-environment)
- [Running the System](#running-the-system)
- [Model Placement](#model-placement)
- [API Reference](#api-reference)
- [Dashboard Pages](#dashboard-pages)
- [Project Structure](#project-structure)
- [License](#license)

---

## System Overview

| Component | Technology |
|-----------|------------|
| Frontend  | React 19 + TypeScript + Vite + Tailwind CSS |
| Backend   | FastAPI + Uvicorn |
| ML Models | TensorFlow/Keras + Ultralytics YOLOv11n |
| Real-time | WebSocket (`/ws/feed`) |
| Security  | HMAC-SHA256 per-frame signature verification |
| State     | Zustand + TanStack Query |
| Map       | Leaflet (Lusail, Qatar base coordinates) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  React Dashboard                    │
│  DashboardPage ─ MissionsPage ─ ThermalToolPage     │
│       │                              │              │
│  useDroneFeed (WebSocket)      API calls (/api/*)   │
└──────────────────┬──────────────────┬───────────────┘
                   │ ws://             │ http://
                   ▼                  ▼
┌─────────────────────────────────────────────────────┐
│                 FastAPI Backend (:8000)              │
│                                                     │
│  /ws/feed          Real-time telemetry + detections │
│  /predict/model1   Custom CNN (FLAME 1 RGB)         │
│  /predict/model2   EfficientNetB0 (FLAME 1 RGB)     │
│  /predict/model3   EfficientNetB0 (FLAME 3 Thermal) │
│  /predict/model4   YOLOv11n object detection        │
│  /predict/model5   Dual-branch Fusion (RGB + NIR)   │
│  /predict/all      Models 1–3 in parallel           │
│  /tools/rgb-to-thermal   Pseudo-thermal converter   │
│  /alerts  /missions  /drone/status                  │
└─────────────────────────────────────────────────────┘
```

---

## Prerequisites

- **Python** 3.10+
- **Node.js** 18+
- **npm** 9+
- **Git LFS** — required to download model weights and the demo video

Install Git LFS once before cloning:

```bash
git lfs install
```

Download Git LFS at [git-lfs.com](https://git-lfs.com) if you don't have it.

---

## Installation

### Clone the repository

```bash
git lfs install   # skip if already done
git clone https://github.com/blondigemini/TRGBDroneSystem.git
cd TRGBDroneSystem
```

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

> **GPU / Apple Silicon users:** TensorFlow GPU drivers are not listed in `requirements.txt`. Install them separately following the [TensorFlow install guide](https://www.tensorflow.org/install).

### Frontend Setup

```bash
cd frontend
npm install
```

### CNN Training Environment

A Conda environment file is provided for training and fine-tuning the models:

```bash
conda env create -f cnn_env.yml
conda activate cnn_env
```

> Remove the `tensorflow-metal` line from `cnn_env.yml` if you are not on Apple Silicon.

---

## Running the System

**1. Start the backend** (from the `backend/` directory):

```bash
uvicorn main:app --reload --port 8000
```

The API is available at `http://localhost:8000`.  
Interactive Swagger docs: `http://localhost:8000/docs`.

**2. Start the frontend** (from the `frontend/` directory):

```bash
npm run dev
```

The dashboard opens at `http://localhost:5173`.

The Vite dev server proxies all `/api/*` requests and the `/ws` WebSocket connection to the backend automatically — no extra configuration needed.

---

## Model Placement

Model weights are stored via Git LFS and downloaded automatically when you clone the repo. No manual placement needed.

```
backend/
├── yolo11n.pt                  ← downloaded via LFS
└── models/
    ├── model1_cnn.h5           ← downloaded via LFS
    ├── model2_efficientnet.keras
    ├── model3_thermal.keras
    ├── model4_yolo.pt
    └── model5_fusion.keras
```

If a model file is missing the backend falls back to **mock mode** for that model — all other endpoints continue to work normally.

---

## API Reference

### Inference Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/predict/model1` | Custom CNN — RGB image, threshold 0.35 |
| `POST` | `/predict/model2` | EfficientNetB0 — RGB image, threshold 0.50 |
| `POST` | `/predict/model3` | EfficientNetB0 — Thermal/grayscale image, threshold 0.50 |
| `POST` | `/predict/model4` | YOLOv11n — RGB image, returns bounding boxes + annotated image |
| `POST` | `/predict/model5` | Dual Fusion — `rgb_file` + `nir_file`, threshold 0.2468 |
| `POST` | `/predict/all` | Models 1–3 in parallel on a single image |

**Optional security field:** pass `signature=<hmac-sha256-hex>` as a form field alongside any image to enable per-frame tamper detection.

### Tools

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tools/rgb-to-thermal` | Convert an RGB image to pseudo-thermal grayscale (CLAHE + gamma) |

### Dashboard Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/alerts` | List active alerts |
| `POST` | `/alerts/{id}/acknowledge` | Acknowledge an alert |
| `GET`  | `/alerts/stats` | Alert statistics |
| `GET`  | `/missions` | List missions |
| `POST` | `/missions` | Create a new mission |
| `POST` | `/missions/{id}/start` | Start a mission |
| `POST` | `/missions/{id}/stop` | Stop/complete a mission |
| `GET`  | `/drone/status` | Current drone telemetry |
| `WS`   | `/ws/feed` | Real-time telemetry, detections, and alerts |
| `GET`  | `/health` | Model load status |

### Example: Run Model 1

```bash
curl -X POST http://localhost:8000/predict/model1 \
  -F "file=@image.jpg"
```

Response:

```json
{
  "model": "Model 1 — Custom CNN (FLAME 1 RGB)",
  "label": "Fire",
  "probability": 0.87,
  "threshold": 0.35,
  "confidence": "High",
  "prediction_time_ms": 142.5,
  "security": {
    "status": "UNSIGNED",
    "frame_hash": "a3f9...",
    "tamper_event": null
  }
}
```

### Example: Run Model 5 (Fusion)

```bash
curl -X POST http://localhost:8000/predict/model5 \
  -F "rgb_file=@rgb.jpg" \
  -F "nir_file=@nir.jpg"
```

---

## Dashboard Pages

### `/` — Main Dashboard
Live drone feed, interactive Leaflet map with flight path and hotspot overlays, mission control panel, alert feed, and telemetry status bar. All data streams in real time over WebSocket.

### `/missions` — Mission Management
Create, start, and stop clearance missions. View mission history with sector-by-sector detection summaries.

### `/thermal-tool` — Thermal Tool
Upload an RGB image, convert it to pseudo-thermal grayscale, and run it through Models 3 and 5 directly from the browser. Useful for testing NIR inputs without a physical thermal camera.

---

## Project Structure

```
TRGBDroneSystem/
├── backend/
│   ├── main.py               # FastAPI app — 5 model endpoints, RGB-to-thermal tool
│   ├── security.py           # HMAC-SHA256 per-frame verification
│   ├── config.py             # Paths, WS interval, drone mode
│   ├── requirements.txt
│   ├── models/               # Model weights (tracked via Git LFS)
│   ├── routers/
│   │   ├── alerts.py
│   │   ├── drone.py
│   │   ├── missions.py
│   │   └── inference.py
│   ├── services/
│   │   ├── model_service.py  # CNN + YOLO inference wrapper
│   │   ├── mock_drone.py     # Simulated drone telemetry
│   │   ├── mock_detector.py  # Simulated detections
│   │   ├── mission_store.py
│   │   └── alert_manager.py
│   ├── schemas/
│   │   ├── detection.py
│   │   ├── alert.py
│   │   ├── mission.py
│   │   └── telemetry.py
│   └── ws/
│       └── feed.py           # WebSocket — telemetry, detections, alerts
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── MissionsPage.tsx
│   │   │   └── ThermalToolPage.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   │   ├── useDroneFeed.ts   # WebSocket state
│   │   │   └── useMockDroneFeed.ts
│   │   ├── api/
│   │   ├── stores/
│   │   └── types/
│   ├── vite.config.ts
│   └── package.json
├── cnn_env.yml               # Conda environment for model training
├── LICENSE
└── README.md
```

---

## License

[MIT](LICENSE) © 2025 Anas Yakoub
