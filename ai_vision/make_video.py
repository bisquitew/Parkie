"""
Convert any YOLOv8-format dataset split into a test video.

Usage:
    python make_video.py --list                                         # see all available datasets + splits
    python make_video.py --dataset cnrpark_dataset --split test         # CNRPark test set (unseen data)
    python make_video.py --dataset pklot_dataset --split test           # PKLot test set
    python make_video.py --dataset cnrpark_dataset --split test --max 500
"""

import cv2
import glob
import os
import argparse
import numpy as np
from pathlib import Path
from collections import defaultdict

OUTPUT_DIR = "assets"
FPS        = 10


def find_datasets():
    """Find all YOLOv8-format dataset folders in the current directory."""
    datasets = {}
    for d in Path(".").iterdir():
        if not d.is_dir():
            continue
        splits = {}
        for split in ["train", "valid", "val", "test"]:
            img_dir = d / split / "images"
            if img_dir.exists():
                imgs = list(img_dir.glob("*.jpg")) + list(img_dir.glob("*.png"))
                if imgs:
                    splits[split] = sorted([str(p) for p in imgs])
        if splits:
            datasets[d.name] = splits
    return datasets


def list_available(datasets):
    if not datasets:
        print("No YOLOv8 datasets found in current directory.")
        return
    print()
    for ds_name, splits in sorted(datasets.items()):
        print(f"  {ds_name}/")
        for split, imgs in sorted(splits.items()):
            print(f"    --split {split:<8}  ({len(imgs)} images)")
        print()
    print("Example:")
    first_ds   = next(iter(datasets))
    first_split = next(iter(datasets[first_ds]))
    print(f"  python make_video.py --dataset {first_ds} --split {first_split}")


def make_video(images, output_path, fps=FPS, max_frames=None):
    if not images:
        print("No images found."); return

    if max_frames and len(images) > max_frames:
        indices = np.linspace(0, len(images)-1, max_frames, dtype=int)
        images  = [images[i] for i in indices]

    first = cv2.imread(images[0])
    if first is None:
        print(f"Cannot read: {images[0]}"); return
    h, w = first.shape[:2]

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    out = cv2.VideoWriter(output_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))

    print(f"Writing {len(images)} frames → {output_path}")
    for i, p in enumerate(images):
        frame = cv2.imread(p)
        if frame is None:
            continue
        if frame.shape[:2] != (h, w):
            frame = cv2.resize(frame, (w, h))
        out.write(frame)
        if (i+1) % 50 == 0:
            print(f"  {i+1}/{len(images)}", end="\r")

    out.release()
    print(f"\nDone → {output_path}  ({w}×{h} @ {fps}fps)")
    print(f"Test: python smart_parking.py --video {output_path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--list",    action="store_true")
    parser.add_argument("--dataset", default=None)
    parser.add_argument("--split",   default="test")
    parser.add_argument("--output",  default=None)
    parser.add_argument("--max",     type=int, default=400)
    parser.add_argument("--fps",     type=int, default=FPS)
    args = parser.parse_args()

    datasets = find_datasets()

    if args.list or args.dataset is None:
        list_available(datasets)
        return

    if args.dataset not in datasets:
        print(f"Dataset not found: {args.dataset}")
        print(f"Available: {list(datasets.keys())}")
        return

    splits = datasets[args.dataset]

    # Accept both "val" and "valid" spellings
    split = args.split
    if split not in splits and split == "val" and "valid" in splits:
        split = "valid"
    elif split not in splits and split == "valid" and "val" in splits:
        split = "val"

    if split not in splits:
        print(f"Split '{args.split}' not found in {args.dataset}/")
        print(f"Available splits: {list(splits.keys())}")
        return

    images = splits[split]
    output = args.output or f"{OUTPUT_DIR}/{args.dataset}_{split}_video.mp4"
    make_video(images, output, args.fps, args.max)


if __name__ == "__main__":
    main()