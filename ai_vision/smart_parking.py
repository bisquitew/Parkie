import cv2
import os
import argparse
from ultralytics import YOLO
from collections import deque
from dotenv import load_dotenv

load_dotenv()

# LOCAL MODEL PATH
MODEL_PATH = "assets/parking_detector.pt"

# Tuning parameters
CONF_THRESHOLD      = 0.35   # lower if spots are missed, raise to cut false positives
PROCESS_EVERY_N     = 2      # run inference every Nth frame for speed
OCCUPANCY_SMOOTHING = 5      # frames to smooth flicker


def main():
    parser = argparse.ArgumentParser()
    src = parser.add_mutually_exclusive_group()
    src.add_argument("--video",  default="assets/demo_video.mp4")
    src.add_argument("--camera", type=int, help="Camera index e.g. 0")
    parser.add_argument("--conf", type=float, default=CONF_THRESHOLD)
    args = parser.parse_args()

    # Load local YOLO model
    if not os.path.exists(MODEL_PATH):
        print(f"Error: {MODEL_PATH} not found!")
        print("Please copy your trained model to assets/ or wait for training to finish.")
        return

    print(f"Loading local PKLot model: {MODEL_PATH}")
    model = YOLO(MODEL_PATH)
    print("Model ready.")

    source = args.camera if args.camera is not None else args.video
    cap    = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"Cannot open: {source}")
        return

    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # temporal smoothing state
    history = {}
    last_detections = []
    frame_idx = 0

    print(f"Feed: {W}x{H}  —  press Q to quit")

    while cap.isOpened():
        ok, frame = cap.read()
        if not ok:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            frame_idx = 0
            continue
        frame_idx += 1

        # ── Inference (throttled) ──────────────────────────
        if frame_idx % PROCESS_EVERY_N == 0:
            results = model(frame, conf=args.conf, verbose=False)
            last_detections = results[0].boxes.data.tolist()

        occupied_count = 0
        free_count     = 0

        # PKLot model specifically detects "space-empty" and "space-occupied"
        # Classes: 0: space-empty, 1: space-occupied (verify with model.names)
        # However, we'll just check the detections
        for det in last_detections:
            x1, y1, x2, y2, conf, cls_id = det
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
            
            # Using model.names to get the label
            label = model.names[int(cls_id)]
            occupied = "occupied" in label.lower()

            # DRAWING Logic
            color = (0, 0, 210) if occupied else (0, 210, 0)
            status_text = "occupied" if occupied else "free"
            
            if occupied:
                occupied_count += 1
            else:
                free_count += 1

            # Transparent Overlay
            sub_img = frame[y1:y2, x1:x2]
            white_rect = np.full(sub_img.shape, color, dtype=np.uint8)
            res = cv2.addWeighted(sub_img, 0.75, white_rect, 0.25, 1.0)
            frame[y1:y2, x1:x2] = res
            
            # Border
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame, status_text, (x1 + 3, y1 + 14),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 255, 255), 1)

        # HUD
        total = occupied_count + free_count
        cv2.rectangle(frame, (0, 0), (W, 38), (15, 15, 15), -1)
        cv2.putText(frame,
                    f"Free: {free_count}   Occupied: {occupied_count}   Total: {total} [Local PKLot]",
                    (8, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (0, 230, 230), 2)

        cv2.imshow("Smart Parking Viewer", frame)
        if cv2.waitKey(200) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    import numpy as np
    main()