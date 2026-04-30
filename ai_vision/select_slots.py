import cv2
import json
import os
import argparse
import numpy as np
from .config import config

class SlotSelector:
    def __init__(self, video_path):
        self.video_path = video_path
        self.slots = []
        self.current_poly = []
        self.frame = None
        self.clone = None
        self.window_name = "Select Slots"

    def mouse_callback(self, event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            self.current_poly.append([x, y])
            if len(self.current_poly) == 4:
                self.slots.append(self.current_poly)
                self.current_poly = []
                print(f"Slot {len(self.slots)} added.")

    def run(self, output_path):
        if not os.path.exists(self.video_path):
            print(f"Error: {self.video_path} not found!")
            return

        cap = cv2.VideoCapture(self.video_path)
        ret, frame = cap.read()
        cap.release()

        if not ret:
            print("Error: Could not read frame from video.")
            return

        self.frame = frame
        self.clone = frame.copy()
        H, W, _ = frame.shape

        cv2.namedWindow(self.window_name, cv2.WINDOW_NORMAL)
        if W > 1280 or H > 720:
            cv2.resizeWindow(self.window_name, 1280, 720)
        cv2.setMouseCallback(self.window_name, self.mouse_callback)

        print("\n--- Parking Slot Selector (Polygon Mode) ---")
        print("1. Click 4 corners for each parking spot.")
        print("2. Press 'r' to reset (clear all slots).")
        print("3. Press 'c' to cancel and exit without saving.")
        print("4. Press 's' to save and exit.")
        print("--------------------------------------------\n")

        while True:
            temp_frame = self.clone.copy()
            
            # Draw existing slots
            for i, poly in enumerate(self.slots):
                pts = np.array(poly, np.int32).reshape((-1, 1, 2))
                cv2.polylines(temp_frame, [pts], True, (0, 255, 0), 2)
                cv2.putText(temp_frame, f"Slot {i+1}", tuple(poly[0]), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

            # Draw current polygon
            if len(self.current_poly) > 0:
                for pt in self.current_poly:
                    cv2.circle(temp_frame, tuple(pt), 4, (0, 255, 255), -1)
                if len(self.current_poly) > 1:
                    pts = np.array(self.current_poly, np.int32).reshape((-1, 1, 2))
                    cv2.polylines(temp_frame, [pts], False, (0, 255, 255), 2)

            cv2.imshow(self.window_name, temp_frame)
            key = cv2.waitKey(1) & 0xFF

            if key == ord("s"):
                self.save_slots(output_path, W, H)
                break
            elif key == ord("r"):
                self.slots = []
                print("Cleared all slots.")
            elif key == ord("c"):
                print("Cancelled.")
                break

        cv2.destroyAllWindows()

    def save_slots(self, output_path, W, H):
        flattened_slots = []
        for poly in self.slots:
            flat_poly = [coord for pt in poly for coord in pt]
            flattened_slots.append(flat_poly)

        data = {
            "video_source": self.video_path,
            "resolution": [W, H],
            "slots": flattened_slots
        }
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(data, f, indent=4)
        print(f"Saved {len(self.slots)} slots to {output_path}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", default="assets/demo_video.mp4", help="Path to video source")
    parser.add_argument("--output", default=config.SLOTS_FILE, help="Output JSON path")
    args = parser.parse_args()

    selector = SlotSelector(args.video)
    selector.run(args.output)

if __name__ == "__main__":
    main()
