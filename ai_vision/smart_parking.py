import cv2
import os
import json
import argparse
import numpy as np
from ultralytics import YOLO
from dotenv import load_dotenv

load_dotenv()

# SETTINGS
SLOTS_FILE = "assets/parking_slots.json"
DEFAULT_MODEL = "yolov8s.pt"  # Upgraded to 'Small' model for better detection at scale.

# Detection classes for cars/vehicles (COCO indices)
# 2: car, 3: motorcycle, 5: bus, 7: truck
COCO_VEHICLE_CLASSES = [2, 3, 5, 7]

def is_point_in_poly(point, poly):
    # poly is a list of [x, y]
    # point is (x, y)
    pts = np.array(poly, np.int32).reshape((-1, 1, 2))
    return cv2.pointPolygonTest(pts, (float(point[0]), float(point[1])), False) >= 0

def calculate_poly_overlap(poly, box):
    # poly: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
    # box: [x1, y1, x2, y2]
    
    # Simple and robust for parking: 
    # Check if the bottom-center of the car is in the polygon.
    # This is much more robust for perspective than box-to-box IoU.
    bx1, by1, bx2, by2 = box
    bottom_center = ((bx1 + bx2) / 2, (by1 + by2) / 2) # Using center for skewed views
    
    if is_point_in_poly(bottom_center, poly):
        return 1.0 # Fully occupied if center is in
    return 0.0

def main():
    parser = argparse.ArgumentParser()
    src = parser.add_mutually_exclusive_group()
    src.add_argument("--video",  default="assets/demo_video.mp4")
    src.add_argument("--camera", type=int, help="Camera index e.g. 0")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Path to YOLO model (.pt)")
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--iou", type=float, default=0.3, help="Overlap threshold for occupancy")
    parser.add_argument("--imgsz", type=int, default=640, help="Inference image size")
    parser.add_argument("--skip-frames", type=int, default=0, help="Number of frames to skip between processing")
    parser.add_argument("--interval", type=float, default=0, help="Seconds between detections (overrides skip-frames)")
    parser.add_argument("--delay", type=int, default=1, help="Delay in ms after each frame")
    parser.add_argument("--debug", action="store_true", help="Draw raw model detections")
    args = parser.parse_args()

    # 1. Load Slots
    if not os.path.exists(SLOTS_FILE):
        print(f"Error: {SLOTS_FILE} not found!")
        print(f"Please run 'python select_slots.py' first to define parking spots.")
        return
    
    with open(SLOTS_FILE, "r") as f:
        slots_data = json.load(f)
    
    parking_slots = slots_data.get("slots", [])
    print(f"Loaded {len(parking_slots)} parking polygons.")

    # 2. Load Model
    print(f"Loading model: {args.model}")
    model = YOLO(args.model)
    print("Model ready.")

    # Determine if we should filter by vehicle classes (COCO) or use all detections (PKLot)
    is_coco = "yolo" in args.model.lower() and "parking_detector" not in args.model.lower()
    
    source = args.camera if args.camera is not None else args.video
    cap    = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"Cannot open: {source}")
        return

    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    interval_frames = int(args.interval * fps) if args.interval > 0 else 0
    
    print(f"\nFeed: {W}x{H} @ {fps:.1f} FPS  —  press Q to quit")
    if interval_frames > 0:
        print(f"Interval mode: Detecting every {args.interval}s (~{interval_frames} frames)")
    print(f"Using {'COCO' if is_coco else 'Custom PKLot'} detection logic.")

    import time
    frame_count = 0
    t_prev = time.time()
    current_fps = 0

    while cap.isOpened():
        ok, frame = cap.read()
        if not ok:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
        
        frame_count = int(cap.get(cv2.CAP_PROP_POS_FRAMES))
        
        # Interval Jumps (Time-based)
        if interval_frames > 0:
            # Jump to the next detection point
            next_frame = frame_count + interval_frames
            cap.set(cv2.CAP_PROP_POS_FRAMES, next_frame)
        
        # Skip frames (Count-based, fallback)
        elif args.skip_frames > 0 and frame_count % (args.skip_frames + 1) != 0:
            continue

        # Inference
        target_classes = COCO_VEHICLE_CLASSES if is_coco else None
        results = model(frame, conf=args.conf, classes=target_classes, imgsz=args.imgsz, verbose=False)
        detections = results[0].boxes.data.tolist()

        occupied_count = 0
        
        # Check each slot (Polygon)
        slot_statuses = [] 
        for i, poly in enumerate(parking_slots):
            is_occupied = False
            for det in detections:
                det_box = det[:4] 
                cls_id  = int(det[5])
                
                # Logic: If point-in-polygon is true, it's occupied
                if calculate_poly_overlap(poly, det_box) > 0.5:
                    if not is_coco:
                        # For PKLot model, check if the label is 'occupied'
                        label = model.names[cls_id].lower()
                        if "occupied" in label:
                            is_occupied = True
                            break
                    else:
                        is_occupied = True
                        break
            
            slot_statuses.append((poly, is_occupied))
            if is_occupied:
                occupied_count += 1

        # Debug drawing (raw detections)
        if args.debug:
            for det in detections:
                dx1, dy1, dx2, dy2, dconf, dcls = det
                dcls_name = model.names[int(dcls)]
                cv2.rectangle(frame, (int(dx1), int(dy1)), (int(dx2), int(dy2)), (255, 255, 0), 1)
                cv2.putText(frame, f"RAW: {dcls_name} {dconf:.2f}", (int(dx1), int(dy1) - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 0), 1)

        # Drawing (OPTIMIZED BATCHED RENDERING)
        overlay_mask = np.zeros(frame.shape, dtype=np.uint8)
        for poly, occupied in slot_statuses:
            pts = np.array(poly, np.int32).reshape((-1, 1, 2))
            color = (0, 0, 210) if occupied else (0, 210, 0)
            status_text = "OCCUPIED" if occupied else "FREE"
            
            cv2.fillPoly(overlay_mask, [pts], color)
            cv2.polylines(frame, [pts], True, color, 2)
            cv2.putText(frame, status_text, (poly[0][0] + 3, poly[0][1] + 15),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

        frame = cv2.addWeighted(frame, 1.0, overlay_mask, 0.3, 0)

        # FPS calculation (only meaningful in non-interval mode)
        t_now = time.time()
        current_fps = 1.0 / (t_now - t_prev) if (t_now - t_prev) > 0 else 0
        t_prev = t_now

        # HUD
        free_count = len(parking_slots) - occupied_count
        mode_text = f"INTERVAL: {args.interval}s" if interval_frames > 0 else f"FPS: {current_fps:.1f}"
        cv2.rectangle(frame, (0, 0), (W, 40), (20, 20, 20), -1)
        cv2.putText(frame,
                    f"FREE: {free_count}   OCCUPIED: {occupied_count}   {mode_text}",
                    (15, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

        cv2.imshow("Smart Parking Viewer", frame)
        if cv2.waitKey(args.delay) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()