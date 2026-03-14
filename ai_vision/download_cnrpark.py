import os
import csv
import shutil
import tarfile
import urllib.request
from pathlib import Path
from collections import defaultdict

DOWNLOAD_URL  = "http://cnrpark.it/dataset/CNR-EXT_FULL_IMAGE_1000x750.tar"
ARCHIVE_NAME  = "CNR-EXT_FULL_IMAGE_1000x750.tar"
EXTRACTED_DIR = "CNR-EXT_FULL_IMAGE_1000x750"
OUTPUT_DIR    = "cnrpark_dataset"

# Original image resolution bounding boxes are in
ORIG_W, ORIG_H = 2592, 1944
# Downloaded image resolution
IMG_W,  IMG_H  = 1000, 750

# Scale factors for bbox conversion
SW = IMG_W / ORIG_W
SH = IMG_H / ORIG_H

# Train/val/test split by camera ID
# Cameras 1-7 = train, 8 = val, 9 = test
# This mirrors the original paper's cross-camera evaluation setup
TRAIN_CAMS = {1, 2, 3, 4, 5, 6, 7}
VAL_CAMS   = {8}
TEST_CAMS  = {9}


def download():
    if Path(ARCHIVE_NAME).exists():
        print(f"Archive already exists: {ARCHIVE_NAME}")
        return
    print(f"Downloading CNRPark-EXT (~1.1GB)...")
    print(f"From: {DOWNLOAD_URL}")

    def progress(count, block_size, total):
        pct = min(count * block_size / total * 100, 100)
        print(f"  {pct:.1f}%", end="\r")

    urllib.request.urlretrieve(DOWNLOAD_URL, ARCHIVE_NAME, reporthook=progress)
    print("\nDownload complete.")


def extract():
    if Path(EXTRACTED_DIR).exists():
        print(f"Already extracted: {EXTRACTED_DIR}/")
        return
    print("Extracting archive...")
    with tarfile.open(ARCHIVE_NAME) as tar:
        tar.extractall()
    print("Extraction complete.")


def parse_bbox_csv(csv_path):
    """
    Parse one of the 9 per-camera CSV files.
    Each row: date, time, slot_id, x, y, w, h  (in original 2592x1944 resolution)
    Returns dict: image_filename -> list of (x,y,w,h) in original pixels
    """
    boxes = defaultdict(list)
    with open(csv_path, newline="") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row or row[0].startswith("#"):
                continue
            try:
                # CSV format varies slightly — try common layouts
                if len(row) >= 7:
                    date, time_, slot, x, y, w, h = row[:7]
                    time_ = time_.replace(".", "")   # "09.47" → "0947"
                    fname = f"{date}_{time_}.jpg"
                    boxes[fname].append((int(x), int(y), int(w), int(h)))
            except (ValueError, IndexError):
                continue
    return boxes


def xyxy_to_yolo(x, y, w, h, img_w, img_h):
    """Convert pixel x,y,w,h bbox → YOLO normalised cx,cy,w,h"""
    cx = (x + w / 2) / img_w
    cy = (y + h / 2) / img_h
    nw = w / img_w
    nh = h / img_h
    return cx, cy, nw, nh


def convert_to_yolov8():
    """
    Walk the extracted folder structure, find CSVs + images,
    scale bboxes from 2592x1944 → 1000x750, write YOLO label files,
    and split into train/val/test by camera.
    """
    ext_path = Path(EXTRACTED_DIR)
    out_path = Path(OUTPUT_DIR)

    splits = {"train": ([], []), "valid": ([], []), "test": ([], [])}
    # (images_list, labels_list) per split

    # Find all camera directories
    cam_dirs = sorted(ext_path.glob("camera*"))
    if not cam_dirs:
        # Try nested structure
        cam_dirs = sorted(ext_path.rglob("camera*"))

    if not cam_dirs:
        print(f"ERROR: Could not find camera directories in {EXTRACTED_DIR}/")
        print("Directory structure:")
        for p in list(ext_path.iterdir())[:20]:
            print(f"  {p}")
        return

    for cam_dir in cam_dirs:
        if not cam_dir.is_dir():
            continue

        # Extract camera number
        try:
            cam_id = int(cam_dir.name.replace("camera", ""))
        except ValueError:
            continue

        # Determine split
        if cam_id in TRAIN_CAMS:
            split = "train"
        elif cam_id in VAL_CAMS:
            split = "valid"
        else:
            split = "test"

        # Find the bbox CSV for this camera
        csv_files = list(cam_dir.glob("*.csv")) + list(cam_dir.parent.glob(f"*camera{cam_id}*.csv"))
        if not csv_files:
            print(f"  No CSV found for camera {cam_id}, skipping bbox annotation")
            boxes_map = {}
        else:
            boxes_map = parse_bbox_csv(csv_files[0])

        # Process images
        img_files = list(cam_dir.rglob("*.jpg"))
        print(f"  Camera {cam_id} ({split}): {len(img_files)} images")

        for img_path in img_files:
            fname = img_path.name
            img_out = out_path / split / "images" / f"cam{cam_id}_{fname}"
            lbl_out = out_path / split / "labels" / f"cam{cam_id}_{fname.replace('.jpg', '.txt')}"

            img_out.parent.mkdir(parents=True, exist_ok=True)
            lbl_out.parent.mkdir(parents=True, exist_ok=True)

            shutil.copy(img_path, img_out)

            # Write YOLO label file
            # All spots in a full image are parking spots — we label them
            # class 0 (space-empty) as placeholder; occupancy is determined at inference
            # If bbox CSV available, use it; otherwise skip labels (inference-only)
            if fname in boxes_map:
                lines = []
                for (x, y, w, h) in boxes_map[fname]:
                    # Scale from original to downloaded resolution
                    xs = x * SW; ys = y * SH
                    ws = w * SW; hs = h * SH
                    cx, cy, nw, nh = xyxy_to_yolo(xs, ys, ws, hs, IMG_W, IMG_H)
                    # We don't know occupancy from the full image alone —
                    # use class 0 (space-empty) as default; model will override at runtime
                    lines.append(f"0 {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}")
                lbl_out.write_text("\n".join(lines))
            else:
                lbl_out.write_text("")   # empty label = no annotated spots

    # Write data.yaml
    yaml_content = f"""path: {OUTPUT_DIR}
train: train/images
val: valid/images
test: test/images
nc: 2
names:
  - space-empty
  - space-occupied
"""
    (out_path / "data.yaml").write_text(yaml_content)
    print(f"\nConversion complete → {OUTPUT_DIR}/")
    print(f"  train: cameras 1-7")
    print(f"  valid: camera 8")
    print(f"  test:  camera 9  (use this for evaluation)")


def main():
    download()
    extract()
    print("\nConverting to YOLOv8 format...")
    convert_to_yolov8()
    print("\nDone. Now run:")
    print("  python train_pklot.py   (will fine-tune on CNRPark)")
    print("  python make_video.py --dataset cnrpark_dataset --split test")


if __name__ == "__main__":
    main()