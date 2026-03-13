"""
Downloads PKLot dataset from Roboflow and trains a YOLOv8n model on it.
Produces assets/parking_detector.pt — a fully local model, no API needed at runtime.

Requirements:
    pip install ultralytics roboflow python-dotenv

Your .env needs:
    ROBOFLOW_API_KEY=your_key_here   # free at roboflow.com — only needed for download

Run:
    python train_pklot.py

Output:
    assets/parking_detector.pt     ← use this in smart_parking.py
"""

import os
import shutil
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "")
OUTPUT_MODEL     = "assets/parking_detector.pt"
DATASET_DIR      = "pklot_dataset"
EPOCHS           = 25       # 25 is enough for ~95%+ mAP on PKLot
IMAGE_SIZE       = 640
BATCH_SIZE       = 16       # lower to 8 if you get out-of-memory errors


def download_dataset():
    """Download PKLot dataset in YOLOv8 format from Roboflow."""
    if not ROBOFLOW_API_KEY:
        raise SystemExit(
            "ROBOFLOW_API_KEY not set in .env\n"
            "Get a free key at roboflow.com — only needed once for download."
        )

    print("Downloading PKLot dataset from Roboflow...")
    from roboflow import Roboflow
    rf      = Roboflow(api_key=ROBOFLOW_API_KEY)
    project = rf.workspace("brad-dwyer").project("pklot-1tros")
    version = project.version(1)
    dataset = version.download("yolov8", location=DATASET_DIR)
    print(f"Dataset saved to: {DATASET_DIR}/")
    return dataset.location


def train(data_yaml_path):
    """Fine-tune YOLOv8n on PKLot. Starts from COCO pretrained weights."""
    from ultralytics import YOLO

    print(f"\nTraining YOLOv8n for {EPOCHS} epochs on PKLot...")
    print("This takes ~10 min on GPU, ~30 min on CPU.\n")

    model   = YOLO("yolov8n.pt")   # start from COCO pretrained
    results = model.train(
        data       = data_yaml_path,
        epochs     = EPOCHS,
        imgsz      = IMAGE_SIZE,
        batch      = BATCH_SIZE,
        name       = "parking_detector",
        exist_ok   = True,
        verbose    = False,
    )

    # Copy best weights to assets/
    best_weights = Path(results.save_dir) / "weights" / "best.pt"
    os.makedirs("assets", exist_ok=True)
    shutil.copy(best_weights, OUTPUT_MODEL)
    print(f"\nDone! Model saved → {OUTPUT_MODEL}")
    print(f"Run: python smart_parking.py --video assets/demo_video.mp4")
    return OUTPUT_MODEL


if __name__ == "__main__":
    # Skip download if dataset already exists
    yaml_path = Path(DATASET_DIR) / "data.yaml"
    if yaml_path.exists():
        print(f"Dataset already exists at {DATASET_DIR}/, skipping download.")
    else:
        download_dataset()

    train(str(yaml_path))