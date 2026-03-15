import cv2
import os
import json
import time
import requests
import numpy as np
from collections import deque
from ultralytics import YOLO
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL         = os.getenv("BACKEND_URL", "http://localhost:8000")
LOT_ID              = os.getenv("LOT_ID")
MODEL_PATH          = "yolo11m.pt"
VEHICLE_CLASSES     = [2, 3, 5, 7, 1]
OCCUPANCY_SMOOTHING = 5
DEFAULT_CONF        = 0.15
INFERENCE_INTERVAL  = 5    # seconds between YOLO runs
REPORT_INTERVAL     = 15   # seconds between backend posts


def is_point_in_poly(point, poly):
    pts = np.array(poly, np.int32).reshape((-1, 1, 2))
    return cv2.pointPolygonTest(pts, (float(point[0]), float(point[1])), False) >= 0


def shrink_poly(poly, factor=0.75):
    pts      = np.array(poly, dtype=np.float32)
    centroid = pts.mean(axis=0)
    return ((pts - centroid) * factor + centroid).astype(int).tolist()


def car_in_slot(poly, box, frame_w=1920, frame_h=1080, max_fraction=0.12, shrink=0.65):
    """
    Returns True if a vehicle detection meaningfully overlaps a slot polygon.
    Ignores detections whose bounding box is too large relative to the frame
    — these are passing buses/trucks, not parked vehicles.
    max_fraction: max allowed box area as fraction of frame (0.12 = 12%)
    """
    bx1, by1, bx2, by2 = box
    box_area   = (bx2 - bx1) * (by2 - by1)
    frame_area = frame_w * frame_h
    if box_area > frame_area * max_fraction:
        return False   # too large — passing vehicle, skip

    cx = (bx1 + bx2) / 2
    cy = (by1 + by2) / 2
    bw = bx2 - bx1
    bh = by2 - by1
    # Sample points across the full box, not just the bottom
    # This handles trucks/vans where the bottom may fall outside the slot polygon
    inner = shrink_poly(poly, factor=shrink)
    check_points = [
        (cx,              by2 - bh * 0.05),  # ground contact center
        (cx - bw * 0.15,  by2 - bh * 0.05),  # ground left
        (cx + bw * 0.15,  by2 - bh * 0.05),  # ground right
        (cx,              by2 - bh * 0.25),  # lower center
        (cx - bw * 0.15,  by2 - bh * 0.25),  # lower left
        (cx + bw * 0.15,  by2 - bh * 0.25),  # lower right
        (cx,              by2 - bh * 0.50),  # mid-lower center
        (cx,              cy),               # absolute center
        (cx - bw * 0.15,  cy),               # mid left
        (cx + bw * 0.15,  cy),               # mid right
    ]
    # Use unshrunken poly as fallback — if 3+ points hit the full polygon
    # but miss the shrunk one, still count it to avoid missing large vehicles
    hits_inner = sum(1 for pt in check_points if is_point_in_poly(pt, inner))
    hits_full  = sum(1 for pt in check_points if is_point_in_poly(pt, poly))
    return hits_inner >= 2 or hits_full >= 4


def denormalize_slots(slots, W, H):
    result = []
    for slot in slots:
        if not isinstance(slot[0], (list, tuple)):
            vals = list(slot)
            if max(vals) <= 1.01:
                vals = [v * (W if i % 2 == 0 else H) for i, v in enumerate(vals)]
            if len(vals) == 4:
                x1, y1, x2, y2 = map(int, vals)
                result.append([[x1,y1],[x2,y1],[x2,y2],[x1,y2]])
            elif len(vals) == 8:
                result.append([[int(vals[i]), int(vals[i+1])] for i in range(0, 8, 2)])
        else:
            is_norm = any(isinstance(p[0], float) and p[0] <= 1.0 for p in slot)
            result.append([[int(p[0]*W), int(p[1]*H)] if is_norm
                           else [int(p[0]), int(p[1])] for p in slot])
    return result


def get_config(slots_file=None):
    config = {"camera_url": None, "slots_data": []}
    if LOT_ID:
        url = f"{BACKEND_URL}/lots/{LOT_ID}/config"
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                config = resp.json()
                print(f"Config fetched from backend for lot: {LOT_ID}")
            else:
                print(f"Backend returned {resp.status_code}")
        except Exception as e:
            print(f"Backend unreachable ({e})")

    if slots_file and os.path.exists(slots_file):
        try:
            with open(slots_file) as f:
                local_slots = json.load(f).get("slots", [])
            if local_slots:
                config["slots_data"] = local_slots
                print(f"Using local slots from {slots_file}")
        except Exception as e:
            print(f"Error reading slots: {e}")

    return config if (config.get("camera_url") or config.get("slots_data")) else None


def update_occupancy(occupied_count):
    if not LOT_ID:
        return
    try:
        resp = requests.post(f"{BACKEND_URL}/update_lot",
                             json={"lot_id": LOT_ID, "detected_cars": occupied_count},
                             timeout=5)
        print(f"Backend updated: {occupied_count} cars  [{resp.status_code}]")
    except Exception as e:
        print(f"Backend update failed: {e}")


def draw_overlay(frame, slots, slot_states, detections, model_names, W):
    """Draw slots + detections onto frame. Uses last known state."""
    for i, poly in enumerate(slots):
        occupied = slot_states[i]
        color    = (0, 0, 220) if occupied else (0, 210, 0)
        pts      = np.array(poly, np.int32).reshape((-1, 1, 2))
        overlay  = frame.copy()
        cv2.fillPoly(overlay, [pts], color)
        cv2.addWeighted(overlay, 0.25, frame, 0.75, 0, frame)
        cv2.polylines(frame, [pts], True, color, 2)

    for d in detections:
        x1,y1,x2,y2,conf,cls = d
        cv2.rectangle(frame,(int(x1),int(y1)),(int(x2),int(y2)),(255,200,0),1)
        cv2.putText(frame, f"{model_names[int(cls)]} {conf:.2f}",
                    (int(x1),int(y1)-5), cv2.FONT_HERSHEY_SIMPLEX, 0.35,(255,200,0),1)

    occupied_count = sum(slot_states.values())
    free = len(slots) - occupied_count
    cv2.rectangle(frame,(0,0),(W,36),(20,20,20),-1)
    cv2.putText(frame,
                f"FREE: {free}   OCCUPIED: {occupied_count}   TOTAL: {len(slots)}",
                (10,24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,230,230), 2)


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--video",   help="Video file path")
    parser.add_argument("--camera",  type=int)
    parser.add_argument("--slots",   help="Local slots JSON override")
    parser.add_argument("--model",   default=MODEL_PATH)
    parser.add_argument("--debug",   action="store_true")
    parser.add_argument("--conf",    type=float, default=DEFAULT_CONF)
    parser.add_argument("--shrink",  type=float, default=0.65,
                        help="Slot shrink factor 0-1 (lower = stricter, fewer false positives)")
    parser.add_argument("--imgsz",   type=int,   default=640,
                        help="Inference image size (640=fast, 1280=better accuracy)")
    parser.add_argument("--infer-every", type=float, default=INFERENCE_INTERVAL,
                        help="Seconds between YOLO inference runs")
    parser.add_argument("--report-every", type=float, default=REPORT_INTERVAL,
                        help="Seconds between backend reports")
    args = parser.parse_args()

    config = get_config(slots_file=args.slots)
    if not config:
        print("No config. Run slot_selector.py first."); return

    source = args.camera if args.camera is not None \
             else args.video if args.video \
             else config.get("camera_url")
    if source is None:
        print("No video source."); return

    slots_raw = config.get("slots_data", [])
    if not slots_raw:
        print("No slots defined."); return

    model = YOLO(args.model)
    print(f"Model: {args.model}  conf={args.conf}  imgsz={args.imgsz}")
    print(f"Inference every {args.infer_every}s  |  Report every {args.report_every}s")

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"Cannot open: {source}"); return

    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"Feed: {W}x{H}  |  Slots: {len(slots_raw)}  |  Press Q to quit")

    slots       = denormalize_slots(slots_raw, W, H)
    history     = {i: deque(maxlen=OCCUPANCY_SMOOTHING) for i in range(len(slots))}
    slot_states = {i: False for i in range(len(slots))}
    last_dets   = []
    last_infer  = 0
    last_report = 0

    if args.debug:
        cv2.namedWindow("Vision Agent", cv2.WINDOW_NORMAL)
        cv2.resizeWindow("Vision Agent", 1280, 720)

    fps   = cap.get(cv2.CAP_PROP_FPS) or 30
    delay = max(1, int(1000 / fps))
    print(f"Smooth sync enabled @ {fps:.1f} FPS (Delay: {delay}ms)")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            if isinstance(source, str) and os.path.exists(source):
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            break

        now = time.time()
        
        # ── 1. AI Inference (every 5s) ────────────────────────────
        if now - last_infer >= args.infer_every:
            # Run YOLO on the current frame
            results   = model(frame, classes=VEHICLE_CLASSES,
                               conf=args.conf, imgsz=args.imgsz, verbose=False)
            last_dets = results[0].boxes.data.tolist()
            last_infer = now

            # Update occupancy state based on the inference frame
            occupied_count = 0
            for i, poly in enumerate(slots):
                raw = any(car_in_slot(poly, d[:4], frame_w=W, frame_h=H, shrink=args.shrink) for d in last_dets)
                history[i].append(raw)
                slot_states[i] = sum(history[i]) > len(history[i]) / 2
                if slot_states[i]:
                    occupied_count += 1
            print(f"[{time.strftime('%H:%M:%S')}] AI Update: {occupied_count}/{len(slots)}")

        # ── 2. Display (Every Frame - 1x Speed) ───────────────────
        if args.debug:
            # We draw using the LAST known detections to keep the overlay visible
            draw_overlay(frame, slots, slot_states, last_dets, model.names, W)
            cv2.imshow("Vision Agent", frame)

        # ── 3. Backend report (every 15s) ─────────────────────────
        if now - last_report >= args.report_every:
            stable_occupied = sum(1 for states in history.values() if sum(states) > len(states)/2)
            update_occupancy(stable_occupied)
            last_report = now

        # Maintain native video speed
        if cv2.waitKey(delay) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()