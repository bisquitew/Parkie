import cv2
import os
import json
import time
import requests
import numpy as np
from ultralytics import YOLO
from dotenv import load_dotenv

load_dotenv()

# SETTINGS
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
LOT_ID = os.getenv("LOT_ID")
MODEL_PATH = "yolov8s.pt" # Default model
INTERVAL = 5 # Seconds between processing
IOU_THRESHOLD = 0.3 # Minimum overlap to consider a slot occupied

# Detection classes for cars/vehicles (COCO indices)
# 2: car, 3: motorcycle, 5: bus, 7: truck
VEHICLE_CLASSES = [2, 3, 5, 7]

def is_point_in_poly(point, poly):
    """
    Check if a point (x, y) is inside a polygon [[x1, y1], [x2, y2], ...].
    """
    pts = np.array(poly, np.int32).reshape((-1, 1, 2))
    return cv2.pointPolygonTest(pts, (float(point[0]), float(point[1])), False) >= 0

def calculate_overlap(poly, box):
    """
    Check if a detection box is in a polygon.
    Uses the bottom-center of the box for perspective robustness.
    box is [x1, y1, x2, y2].
    """
    bx1, by1, bx2, by2 = box
    bottom_center = ((bx1 + bx2) / 2, by2) 
    return is_point_in_poly(bottom_center, poly)

def get_config(slots_file=None):
    """Fetch camera URL and slot coordinates from the backend or local file."""
    # Local override for slots
    local_slots = []
    if slots_file and os.path.exists(slots_file):
        try:
            with open(slots_file, "r") as f:
                data = json.load(f)
                # Handle both our local format and backend format
                local_slots = data.get("slots", [])
                print(f"Loaded {len(local_slots)} slots from local file: {slots_file}")
        except Exception as e:
            print(f"Error reading local slots file: {e}")

    if not LOT_ID:
        print("Note: LOT_ID not set. Using local config only.")
        return {"camera_url": None, "slots_data": local_slots} if local_slots else None
    
    url = f"{BACKEND_URL}/lots/{LOT_ID}/config"
    try:
        response = requests.get(url)
        response.raise_for_status()
        config = response.json()
        if local_slots:
            config["slots_data"] = local_slots
        return config
    except Exception as e:
        print(f"Error fetching config from {url}: {e}")
        if local_slots:
            return {"camera_url": None, "slots_data": local_slots}
        return None

def update_occupancy(occupied_count):
    """Send detection results to the backend."""
    url = f"{BACKEND_URL}/update_lot"
    payload = {
        "lot_id": LOT_ID,
        "detected_cars": occupied_count
    }
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        print(f"Successfully updated backend: {payload}")
        return response.json()
    except Exception as e:
        print(f"Error updating occupancy: {e}")
        return None

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", help="Override camera feed with a local video file")
    parser.add_argument("--slots", help="Path to local slots JSON file (fine-tuning)")
    parser.add_argument("--debug", action="store_true", help="Show visualization window")
    args = parser.parse_args()

    print(f"Starting AI Vision Agent for Lot: {LOT_ID}")
    
    # 1. Initialization
    config = get_config(slots_file=args.slots)
    if not config:
        print("Could not fetch configuration. Exiting.")
        return
    
    # Priority: CLI --video > Backend config > None
    camera_url = args.video if args.video else config.get("camera_url")
    slots_data = config.get("slots_data", []) # List of [x1, y1, x2, y2]
    
    if not camera_url:
        print("Error: No camera URL or video source provided.")
        return

    print(f"Loaded {len(slots_data)} slots.")
    print(f"Camera Feed: {camera_url}")
    
    model = YOLO(MODEL_PATH)
    print("YOLO model loaded.")

    # For visualization if debug is enabled
    if args.debug:
        cv2.namedWindow("Vision Agent Debug", cv2.WINDOW_NORMAL)

    while True:
        start_time = time.time()
        
        # 2. Capture Frame
        cap = cv2.VideoCapture(camera_url)
        ret, frame = cap.read()
        cap.release() 
        
        if not ret:
            print("Failed to capture frame from camera.")
            time.sleep(5)
            continue
            
        # 3. Detection
        results = model(frame, classes=VEHICLE_CLASSES, verbose=False)
        detections = results[0].boxes.data.tolist()
        
        # 4. Occupancy Logic
        occupied_slots_count = 0
        
        for poly in slots_data:
            is_occupied = False
            for det in detections:
                det_box = det[:4]
                if calculate_overlap(poly, det_box):
                    is_occupied = True
                    break
            
            if is_occupied:
                occupied_slots_count += 1

            if args.debug:
                color = (0, 0, 255) if is_occupied else (0, 255, 0)
                pts = np.array(poly, np.int32).reshape((-1, 1, 2))
                cv2.polylines(frame, [pts], True, color, 2)
            
        print(f"Detection complete. Occupied: {occupied_slots_count}/{len(slots_data)}")
        
        # 5. Report to Backend
        update_occupancy(occupied_slots_count)

        if args.debug:
            cv2.imshow("Vision Agent Debug", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        
        # 6. Wait for next interval
        elapsed = time.time() - start_time
        wait_time = max(0, INTERVAL - elapsed)
        if wait_time > 0:
            time.sleep(wait_time)

if __name__ == "__main__":
    main()
