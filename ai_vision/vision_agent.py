import cv2
import os
import json
import time
import requests
import numpy as np
from collections import deque
from ultralytics import YOLO
from .config import config
from .utils.geometry import car_in_slot, denormalize_slots

def get_backend_config(slots_file=None):
    backend_cfg = {"camera_url": None, "slots_data": []}
    if config.LOT_ID:
        url = f"{config.BACKEND_URL}/lots/{config.LOT_ID}/config"
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                backend_cfg = resp.json()
                print(f"Config fetched from backend for lot: {config.LOT_ID}")
            else:
                print(f"Backend returned {resp.status_code}")
        except Exception as e:
            print(f"Backend unreachable ({e})")

    if slots_file and os.path.exists(slots_file):
        try:
            with open(slots_file) as f:
                local_slots = json.load(f).get("slots", [])
            if local_slots:
                backend_cfg["slots_data"] = local_slots
                print(f"Using local slots from {slots_file}")
        except Exception as e:
            print(f"Error reading slots: {e}")

    return backend_cfg if (backend_cfg.get("camera_url") or backend_cfg.get("slots_data")) else None

def update_occupancy(occupied_count):
    if not config.LOT_ID:
        return
    try:
        resp = requests.post(f"{config.BACKEND_URL}/vision/update_lot",
                             json={"lot_id": config.LOT_ID, "detected_cars": occupied_count},
                             timeout=5)
        print(f"Backend updated: {occupied_count} cars  [{resp.status_code}]")
    except Exception as e:
        print(f"Backend update failed: {e}")

def draw_overlay(frame, slots, slot_states, detections, model_names, W):
    for i, poly in enumerate(slots):
        occupied = slot_states[i]
        color = (0, 0, 220) if occupied else (0, 210, 0)
        pts = np.array(poly, np.int32).reshape((-1, 1, 2))
        overlay = frame.copy()
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
    parser.add_argument("--video", help="Video file path")
    parser.add_argument("--camera", type=int)
    parser.add_argument("--slots", help="Local slots JSON override")
    parser.add_argument("--model", default=config.MODEL_PATH)
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("--conf", type=float, default=config.DEFAULT_CONF)
    parser.add_argument("--shrink", type=float, default=0.65)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--infer-every", type=float, default=config.INFERENCE_INTERVAL)
    parser.add_argument("--report-every", type=float, default=config.REPORT_INTERVAL)
    args = parser.parse_args()

    backend_cfg = get_backend_config(slots_file=args.slots)
    if not backend_cfg:
        print("No config. Run select_slots.py first."); return

    source = args.camera if args.camera is not None \
             else args.video if args.video \
             else backend_cfg.get("camera_url")
    if source is None:
        print("No video source."); return

    slots_raw = backend_cfg.get("slots_data", [])
    model = YOLO(args.model)
    
    while True: # Outer loop for reconnection
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            print(f"Cannot open: {source}. Retrying in {config.RETRY_BACKOFF}s...")
            time.sleep(config.RETRY_BACKOFF)
            continue

        W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        slots = denormalize_slots(slots_raw, W, H)
        history = {i: deque(maxlen=config.OCCUPANCY_SMOOTHING) for i in range(len(slots))}
        slot_states = {i: False for i in range(len(slots))}
        last_dets = []
        last_infer = 0
        last_report = 0

        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        delay = max(1, int(1000 / fps))

        if args.debug:
            cv2.namedWindow("Vision Agent", cv2.WINDOW_NORMAL)
            cv2.resizeWindow("Vision Agent", 1024, 576)

        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    # If it's a file, loop it. If it's a stream, it might have dropped.
                    if isinstance(source, str) and os.path.exists(source):
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        continue
                    else:
                        print("Stream dropped.")
                        break

                now = time.time()
                
                if now - last_infer >= args.infer_every:
                    results = model(frame, classes=config.VEHICLE_CLASSES,
                                       conf=args.conf, imgsz=args.imgsz, verbose=False)
                    last_dets = results[0].boxes.data.tolist()
                    last_infer = now

                    occupied_count = 0
                    for i, poly in enumerate(slots):
                        raw = any(car_in_slot(poly, d[:4], frame_w=W, frame_h=H, shrink=args.shrink) for d in last_dets)
                        history[i].append(raw)
                        slot_states[i] = sum(history[i]) > len(history[i]) / 2
                        if slot_states[i]:
                            occupied_count += 1

                if args.debug:
                    draw_overlay(frame, slots, slot_states, last_dets, model.names, W)
                    cv2.imshow("Vision Agent", frame)

                if now - last_report >= args.report_every:
                    stable_occupied = sum(1 for states in history.values() if sum(states) > len(states)/2)
                    update_occupancy(stable_occupied)
                    last_report = now

                if cv2.waitKey(delay) & 0xFF == ord('q'):
                    cap.release()
                    cv2.destroyAllWindows()
                    return

        except Exception as e:
            print(f"Error during execution: {e}")
        
        cap.release()
        print(f"Reconnecting in {config.RETRY_BACKOFF}s...")
        time.sleep(config.RETRY_BACKOFF)

if __name__ == "__main__":
    main()
