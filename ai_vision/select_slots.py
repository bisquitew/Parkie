import cv2
import json
import os
import argparse
import numpy as np

# Global variables to store slot coordinates
slots = []
current_poly = []

def mouse_callback(event, x, y, flags, param):
    global current_poly, slots

    if event == cv2.EVENT_LBUTTONDOWN:
        current_poly.append([x, y])
        
        if len(current_poly) == 4:
            slots.append(current_poly)
            current_poly = []
            print(f"Slot {len(slots)} added.")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", default="assets/demo_video.mp4", help="Path to video source")
    parser.add_argument("--output", default="assets/parking_slots.json", help="Output JSON path")
    args = parser.parse_args()

    if not os.path.exists(args.video):
        print(f"Error: {args.video} not found!")
        return

    cap = cv2.VideoCapture(args.video)
    ret, frame = cap.read()
    cap.release()

    if not ret:
        print("Error: Could not read frame from video.")
        return

    H, W, _ = frame.shape
    clone = frame.copy()
    cv2.namedWindow("Select Slots")
    cv2.setMouseCallback("Select Slots", mouse_callback)

    print("\n--- Parking Slot Selector (Polygon Mode) ---")
    print("1. Click 4 corners for each parking spot.")
    print("2. Press 'r' to reset (clear all slots).")
    print("3. Press 'c' to cancel and exit without saving.")
    print("4. Press 's' to save and exit.")
    print("--------------------------------------------\n")

    while True:
        temp_frame = clone.copy()
        
        # Draw existing slots (Polygons)
        for i, poly in enumerate(slots):
            pts = np.array(poly, np.int32).reshape((-1, 1, 2))
            cv2.polylines(temp_frame, [pts], True, (0, 255, 0), 2)
            cv2.putText(temp_frame, f"Slot {i+1}", tuple(poly[0]), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

        # Draw currently being drawn polygon
        if len(current_poly) > 0:
            for pt in current_poly:
                cv2.circle(temp_frame, tuple(pt), 4, (0, 255, 255), -1)
            
            if len(current_poly) > 1:
                pts = np.array(current_poly, np.int32).reshape((-1, 1, 2))
                cv2.polylines(temp_frame, [pts], False, (0, 255, 255), 2)

        cv2.imshow("Select Slots", temp_frame)
        key = cv2.waitKey(1) & 0xFF

        if key == ord("s"):
            # Save slots in flat format [x1, y1, x2, y2, x3, y3, x4, y4] as per backend docs
            flattened_slots = []
            for poly in slots:
                flat_poly = [coord for pt in poly for coord in pt]
                flattened_slots.append(flat_poly)

            data = {
                "video_source": args.video,
                "resolution": [W, H],
                "slots": flattened_slots
            }
            os.makedirs(os.path.dirname(args.output), exist_ok=True)
            with open(args.output, "w") as f:
                json.dump(data, f, indent=4)
            print(f"Saved {len(slots)} slots to {args.output}")
            break
        
        elif key == ord("r"):
            slots.clear()
            print("Cleared all slots.")

        elif key == ord("c"):
            print("Cancelled.")
            break

    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
