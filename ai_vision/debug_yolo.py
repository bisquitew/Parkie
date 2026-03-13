import cv2
from ultralytics import YOLO

VIDEO_SOURCE = "assets/demo_video.mp4"
MODEL_PATH   = "assets/yolo11n.pt"

COCO_NAMES = {
    0:"person", 1:"bicycle", 2:"car", 3:"motorcycle", 4:"airplane",
    5:"bus", 6:"train", 7:"truck", 8:"boat", 9:"traffic light",
    14:"bird", 15:"cat", 16:"dog", 24:"backpack", 25:"umbrella",
    56:"chair", 57:"couch", 58:"potted plant", 59:"bed", 60:"dining table",
    62:"tv", 63:"laptop", 67:"cell phone", 72:"refrigerator"
}

model = YOLO(MODEL_PATH)
cap   = cv2.VideoCapture(VIDEO_SOURCE)
ok, frame = cap.read()
cap.release()

if not ok:
    print("Could not read frame"); exit()

# Run with NO class filter and LOW confidence so you see everything
results     = model(frame, conf=0.20, verbose=False)
detections  = results[0].boxes.data.tolist()

print(f"\n{'─'*55}")
print(f"{'#':<4} {'Class':<18} {'Conf':>6}   {'Box (x1,y1,x2,y2)'}")
print(f"{'─'*55}")
for i, d in enumerate(detections):
    x1,y1,x2,y2,conf,cls = d
    cls  = int(cls)
    name = COCO_NAMES.get(cls, f"class_{cls}")
    print(f"{i:<4} {name:<18} {conf:>6.2f}   {int(x1)},{int(y1)},{int(x2)},{int(y2)}")
print(f"{'─'*55}")
print(f"Total: {len(detections)} detections\n")

# Draw ALL detections on frame — colour by class
for d in detections:
    x1,y1,x2,y2,conf,cls = d
    cls  = int(cls)
    name = COCO_NAMES.get(cls, f"cls{cls}")
    # unique colour per class
    colour = tuple(int(c) for c in (
        (cls * 37) % 255,
        (cls * 97) % 255,
        (cls * 157) % 255
    ))
    cv2.rectangle(frame, (int(x1),int(y1)), (int(x2),int(y2)), colour, 2)
    cv2.putText(frame, f"{name} {conf:.2f}",
                (int(x1), int(y1)-6),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, colour, 1)

cv2.imwrite("assets/debug_detections.jpg", frame)
print("Saved → assets/debug_detections.jpg")