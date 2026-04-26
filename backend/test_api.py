#!/usr/bin/env python3
"""
test_api.py — Smoke-test script for the Fire Detection API.

Usage:
    python test_api.py [--base-url http://localhost:8000]

If ./sample_images/ contains images, those are used.
Otherwise, synthetic random-noise images are generated for testing.
"""
import argparse
import io
import json
import sys
from pathlib import Path

import numpy as np
import requests
from PIL import Image

DEFAULT_BASE_URL = "http://localhost:8000"
SAMPLE_DIR = Path(__file__).resolve().parent / "sample_images"
BASE_URL = DEFAULT_BASE_URL

# ─── Helpers ──────────────────────────────────────────────────────────────────

def make_synthetic_image(width=224, height=224, mode="RGB") -> bytes:
    """Generate a random noise image and return as JPEG bytes."""
    if mode == "L":
        arr = np.random.randint(0, 256, (height, width), dtype=np.uint8)
    else:
        arr = np.random.randint(0, 256, (height, width, 3), dtype=np.uint8)
    img = Image.fromarray(arr, mode=mode)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.getvalue()


def find_sample_image(substrings=("rgb", "fire", "sample", "test")) -> bytes | None:
    """Look for a sample image in ./sample_images/; return bytes or None."""
    if not SAMPLE_DIR.exists():
        return None
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.bmp"):
        for p in sorted(SAMPLE_DIR.glob(ext)):
            name_lower = p.stem.lower()
            if any(s in name_lower for s in substrings):
                return p.read_bytes()
    # Fall back to any image
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.bmp"):
        for p in sorted(SAMPLE_DIR.glob(ext)):
            return p.read_bytes()
    return None


def find_thermal_image() -> bytes | None:
    """Look for a thermal/grayscale sample image."""
    if not SAMPLE_DIR.exists():
        return None
    for ext in ("*.jpg", "*.jpeg", "*.png"):
        for p in sorted(SAMPLE_DIR.glob(ext)):
            if "thermal" in p.stem.lower() or "gray" in p.stem.lower():
                return p.read_bytes()
    return None


def find_nir_image() -> bytes | None:
    """Look for a NIR sample image."""
    if not SAMPLE_DIR.exists():
        return None
    for ext in ("*.jpg", "*.jpeg", "*.png"):
        for p in sorted(SAMPLE_DIR.glob(ext)):
            if "nir" in p.stem.lower():
                return p.read_bytes()
    return None


def pp(data: dict):
    """Pretty-print JSON."""
    print(json.dumps(data, indent=2, default=str))


def separator(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


# ─── Tests ────────────────────────────────────────────────────────────────────

def test_health():
    separator("GET /health")
    r = requests.get(f"{BASE_URL}/health")
    print(f"Status: {r.status_code}")
    data = r.json()
    pp(data)
    loaded = [k for k, v in data.get("models", {}).items() if v]
    not_loaded = [k for k, v in data.get("models", {}).items() if not v]
    print(f"\n  Loaded:     {loaded}")
    print(f"  Not loaded: {not_loaded}")
    return data


def test_predict(endpoint: str, files: dict, label: str):
    separator(f"POST /predict/{endpoint}")
    try:
        r = requests.post(f"{BASE_URL}/predict/{endpoint}", files=files, timeout=120)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            # Truncate annotated_image for display
            if "annotated_image" in data and data["annotated_image"]:
                data["annotated_image"] = data["annotated_image"][:80] + "... (truncated)"
            pp(data)
        else:
            print(f"Error: {r.text}")
    except requests.exceptions.ConnectionError:
        print(f"  SKIPPED — could not connect to {BASE_URL}")
    except Exception as e:
        print(f"  ERROR: {e}")


def main():
    global BASE_URL
    parser = argparse.ArgumentParser(description="Test Fire Detection API endpoints")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="API base URL")
    args = parser.parse_args()
    BASE_URL = args.base_url.rstrip("/")

    print(f"Testing API at: {BASE_URL}")

    # Health check
    try:
        health = test_health()
    except requests.exceptions.ConnectionError:
        print(f"\nERROR: Cannot connect to {BASE_URL}")
        print("Make sure the server is running: uvicorn main:app --reload --port 8000")
        sys.exit(1)

    # Prepare images
    rgb_bytes = find_sample_image() or make_synthetic_image(224, 224, "RGB")
    thermal_bytes = find_thermal_image() or make_synthetic_image(224, 224, "L")
    nir_bytes = find_nir_image() or make_synthetic_image(224, 224, "L")

    source = "sample_images/" if find_sample_image() else "synthetic (random noise)"
    print(f"\nImage source: {source}")

    # Model 1 — Custom CNN
    test_predict("model1", {"file": ("test.jpg", rgb_bytes, "image/jpeg")}, "Model 1")

    # Model 2 — EfficientNetB0
    test_predict("model2", {"file": ("test.jpg", rgb_bytes, "image/jpeg")}, "Model 2")

    # Model 3 — Thermal
    test_predict("model3", {"file": ("test.jpg", thermal_bytes, "image/jpeg")}, "Model 3")

    # Model 4 — YOLO
    test_predict("model4", {"file": ("test.jpg", rgb_bytes, "image/jpeg")}, "Model 4")

    # Model 5 — Fusion (two files)
    separator("POST /predict/model5")
    try:
        r = requests.post(
            f"{BASE_URL}/predict/model5",
            files={
                "rgb_file": ("rgb.jpg", rgb_bytes, "image/jpeg"),
                "nir_file": ("nir.jpg", nir_bytes, "image/jpeg"),
            },
            timeout=120,
        )
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            pp(r.json())
        else:
            print(f"Error: {r.text}")
    except requests.exceptions.ConnectionError:
        print(f"  SKIPPED — could not connect to {BASE_URL}")
    except Exception as e:
        print(f"  ERROR: {e}")

    # /predict/all — Models 1-3 in parallel
    test_predict("all", {"file": ("test.jpg", rgb_bytes, "image/jpeg")}, "All (1-3)")

    separator("DONE")
    print("All endpoint tests completed.\n")


if __name__ == "__main__":
    main()
