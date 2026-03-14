"""
Fine-tunes an existing PKLot-trained model on CNRPark only.
Starts from your already-trained weights instead of scratch —
no redundant re-training on PKLot data.

Requirements:
    pip install ultralytics roboflow python-dotenv pyyaml

.env:
    ROBOFLOW_API_KEY=your_key_here

Run:
    python train_pklot.py
"""

import os
import shutil
import yaml
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ROBOFLOW_API_KEY  = os.getenv("ROBOFLOW_API_KEY", "")
EXISTING_WEIGHTS  = "assets/parking_detector.pt"   # your already-trained PKLot model
OUTPUT_MODEL      = "assets/parking_detector.pt"   # overwrite with improved model
PKLOT_DIR         = "pklot_dataset"
CNR_DIR           = "cnrpark_dataset"
FINETUNE_YAML     = "finetune_data.yaml"

# Fewer epochs + lower LR for fine-tuning — we're adjusting, not relearning
EPOCHS            = 20
IMAGE_SIZE        = 640
BATCH_SIZE        = 32
LEARNING_RATE     = 0.0005   # ~10x lower than default — prevents overwriting PKLot knowledge


def download_cnrpark():
    if Path(CNR_DIR).exists():
        print(f"CNRPark already downloaded, skipping.")
        return
    if not ROBOFLOW_API_KEY:
        raise SystemExit(
            "ROBOFLOW_API_KEY not set in .env\n"
            "Get a free key at roboflow.com"
        )
    from roboflow import Roboflow
    rf      = Roboflow(api_key=ROBOFLOW_API_KEY)
    project = rf.workspace("university-projects-z0rtf").project("cnrpark-ext")
    project.version(1).download("yolov8", location=CNR_DIR)
    print(f"Downloaded → {CNR_DIR}/")


def build_finetune_yaml():
    """
    Train only on CNRPark images.
    Validate on both PKLot + CNRPark so we can see if PKLot accuracy is preserved.
    """
    config = {
        "path": ".",
        "train": [
            f"{CNR_DIR}/train/images",    # new data only
        ],
        "val": [
            f"{PKLOT_DIR}/valid/images",  # watch for regression on original data
            f"{CNR_DIR}/valid/images",    # and improvement on new data
        ],
        "nc": 2,
        "names": ["space-empty", "space-occupied"],
    }
    with open(FINETUNE_YAML, "w") as f:
        yaml.dump(config, f, default_flow_style=False)
    print(f"Fine-tune config → {FINETUNE_YAML}")


def finetune():
    from ultralytics import YOLO
    import torch

    if not torch.cuda.is_available():
        raise SystemExit(
            "CUDA not available.\n"
            "Fix: pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121"
        )

    if not Path(EXISTING_WEIGHTS).exists():
        raise SystemExit(
            f"Existing weights not found: {EXISTING_WEIGHTS}\n"
            "Copy your trained model to assets/parking_detector.pt first."
        )

    gpu  = torch.cuda.get_device_name(0)
    vram = torch.cuda.get_device_properties(0).total_memory / 1e9
    print(f"\nGPU: {gpu} ({vram:.1f} GB VRAM)")
    print(f"Fine-tuning from: {EXISTING_WEIGHTS}")
    print(f"New data: CNRPark only ({EPOCHS} epochs, lr={LEARNING_RATE})\n")

    # Load YOUR weights, not the generic yolov8s.pt
    model   = YOLO(EXISTING_WEIGHTS)
    results = model.train(
        data      = FINETUNE_YAML,
        epochs    = EPOCHS,
        imgsz     = IMAGE_SIZE,
        batch     = BATCH_SIZE,
        name      = "parking_detector_finetuned",
        exist_ok  = True,
        device    = 0,
        cache     = "ram",
        workers   = 8,
        amp       = True,
        cos_lr    = True,
        optimizer = "AdamW",
        lr0       = LEARNING_RATE,   # low LR = gentle adjustment, preserves PKLot knowledge
        lrf       = 0.1,             # final LR = lr0 * lrf
        freeze    = 10,              # freeze first 10 backbone layers — only train the head
                                     # this is the key to not forgetting PKLot
    )

    best = Path(results.save_dir) / "weights" / "best.pt"
    os.makedirs("assets", exist_ok=True)
    shutil.copy(best, OUTPUT_MODEL)
    print(f"\nDone! Updated model saved → {OUTPUT_MODEL}")
    print(f"Test: python smart_parking.py --video assets/val_video.mp4")


if __name__ == "__main__":
    download_cnrpark()
    build_finetune_yaml()
    finetune()