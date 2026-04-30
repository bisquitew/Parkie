import cv2
import os
import json
import argparse
import numpy as np
import time
from ultralytics import YOLO
from .utils.geometry import car_in_slot, denormalize_slots

# SETTINGS
SLOTS_FILE = "assets/parking_slots.json"
DEFAULT_MODEL = "yolov8s.pt"

COCO_VEHICLE_CLASSES = [2, 3, 5, 7]

def main():
    parser = argparse.ArgumentParser()
    src = parser.add_mutually_exclusive_group()
    src.add_argument("--video",  default="assets/demo_video.mp4")
    src.add_argument("--camera", type=int)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--interval", type=float, default=0)
    parser.add_argument("--delay", type=int, default=1)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    if not os.path.exists(SLOTS_FILE):
        print(f"Error: {SLOTS_FILE} not found!")
        return
    
    with open(SLOTS_FILE, "r") as f:
        slots_data = json.load(f)
    
    slots_raw = slots_data.get("slots", [])
    
    model = YOLO(args.model)
    is_coco = "yolo" in args.model.lower() and "parking_detector" not in args.model.lower()
    
    source = args.camera if args.camera is not None else args.video
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"Cannot open: {source}")
        return

    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    
    slots = denormalize_slots(slots_raw, W, H)
    interval_frames = int(args.interval * fps) if args.interval > 0 else 0
    
    t_prev = time.time()

    while cap.isOpened():
        ok, frame = cap.read()
        if not ok:
            if isinstance(source, str) and os.path.exists(source):
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            break
        
        frame_count = int(cap.get(cv2.CAP_PROP_POS_FRAMES))
        if interval_frames > 0:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_count + interval_frames)

        target_classes = COCO_VEHICLE_CLASSES if is_coco else None
        results = model(frame, conf=args.conf, classes=target_classes, imgsz=args.imgsz, verbose=False)
        detections = results[0].boxes.data.tolist()

        occupied_count = 0
        slot_statuses = [] 
        for poly in slots:
            is_occupied = False
            for det in detections:
                if car_in_slot(poly, det[:4], frame_w=W, frame_h=H):
                    if not is_coco:
                        cls_id = int(det[5])
                        if "occupied" in model.names[cls_id].lower():
                            is_occupied = True
                            break
                    else:
                        is_occupied = True
                        break
            
            slot_statuses.append((poly, is_occupied))
            if is_occupied:
                occupied_count += 1

        # Drawing
        overlay_mask = np.zeros(frame.shape, dtype=np.uint8)
        for poly, occupied in slot_statuses:
            pts = np.array(poly, np.int32).reshape((-1, 1, 2))
            color = (0, 0, 210) if occupied else (0, 210, 0)
            cv2.fillPoly(overlay_mask, [pts], color)
            cv2.polylines(frame, [pts], True, color, 2)

        frame = cv2.addWeighted(frame, 1.0, overlay_mask, 0.3, 0)

        free_count = len(slots) - occupied_count
        cv2.rectangle(frame, (0, 0), (W, 40), (20, 20, 20), -1)
        cv2.putText(frame, f"FREE: {free_count}   OCCUPIED: {occupied_count}",
                    (15, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

        cv2.imshow("Smart Parking Viewer", frame)
        if cv2.waitKey(args.delay) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
