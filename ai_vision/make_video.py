"""
Browse and convert PKLot dataset images into test videos.
Lists available cameras/splits so you can pick which one to use.

Usage:
    python make_video.py --list                          # see what's available
    python make_video.py --camera 2 --split val          # make video from cam2 val set
    python make_video.py --all                           # one video per camera
"""

import cv2
import glob
import os
import argparse
from pathlib import Path
from collections import defaultdict

DATASET_DIR = "pklot_dataset"
OUTPUT_DIR  = "assets"
FPS         = 10


def find_images():
    """Scan dataset and group images by inferred camera/source."""
    all_images = sorted(glob.glob(f"{DATASET_DIR}/**/*.jpg", recursive=True))

    # Group by split (train/val/test) and try to detect sub-cameras
    groups = defaultdict(list)
    for p in all_images:
        parts = Path(p).parts
        # parts like: pklot_dataset/train/images/filename.jpg
        split = parts[1] if len(parts) > 2 else "unknown"
        groups[split].append(p)

    return groups, all_images


def list_available(groups):
    print(f"\nDataset: {DATASET_DIR}/")
    print(f"{'Split':<12} {'Images':>8}")
    print("─" * 25)
    total = 0
    for split, imgs in sorted(groups.items()):
        print(f"{split:<12} {len(imgs):>8}")
        total += len(imgs)
    print("─" * 25)
    print(f"{'TOTAL':<12} {total:>8}")
    print()
    print("Usage examples:")
    print("  python make_video.py --split train --max 300 --output assets/train_video.mp4")
    print("  python make_video.py --split val   --max 200 --output assets/val_video.mp4")
    print("  python make_video.py --split test  --max 200 --output assets/test_video.mp4")
    print("  python make_video.py --all")


def make_video(images, output_path, fps=FPS, max_frames=None):
    if not images:
        print(f"No images found."); return

    if max_frames:
        # Sample evenly so you get coverage across the full set, not just the start
        import numpy as np
        indices = np.linspace(0, len(images)-1, min(max_frames, len(images)), dtype=int)
        images  = [images[i] for i in indices]

    # Read first frame to get dimensions
    first = cv2.imread(images[0])
    if first is None:
        print(f"Cannot read: {images[0]}"); return
    h, w = first.shape[:2]

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    out = cv2.VideoWriter(output_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))

    print(f"Writing {len(images)} frames → {output_path}")
    for i, p in enumerate(images):
        frame = cv2.imread(p)
        if frame is None:
            continue
        # Resize if inconsistent sizes in dataset
        if frame.shape[:2] != (h, w):
            frame = cv2.resize(frame, (w, h))
        out.write(frame)
        if (i+1) % 50 == 0:
            print(f"  {i+1}/{len(images)}", end="\r")

    out.release()
    print(f"\nDone → {output_path}  ({w}×{h} @ {fps}fps)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--list",   action="store_true", help="List available splits")
    parser.add_argument("--split",  default="val", choices=["train","val","test"])
    parser.add_argument("--output", default=None)
    parser.add_argument("--max",    type=int, default=300, help="Max frames in video")
    parser.add_argument("--fps",    type=int, default=FPS)
    parser.add_argument("--all",    action="store_true", help="Make one video per split")
    args = parser.parse_args()

    groups, _ = find_images()

    if not groups:
        print(f"No images found in {DATASET_DIR}/")
        print("Run train_pklot.py first to download the dataset.")
        return

    if args.list or (not args.all and not args.split):
        list_available(groups)
        return

    if args.all:
        for split, imgs in sorted(groups.items()):
            out = f"{OUTPUT_DIR}/{split}_video.mp4"
            make_video(imgs, out, args.fps, args.max)
        return

    imgs = groups.get(args.split, [])
    if not imgs:
        print(f"No images found for split: {args.split}")
        list_available(groups)
        return

    output = args.output or f"{OUTPUT_DIR}/{args.split}_video.mp4"
    make_video(imgs, output, args.fps, args.max)
    print(f"\nTest with:")
    print(f"  python smart_parking.py --video {output}")


if __name__ == "__main__":
    main()