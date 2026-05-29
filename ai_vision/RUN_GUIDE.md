# 🅿️ Parkie AI Vision Run Guide

Follow these steps from the project root directory to set up and run the AI vision pipeline on your local videos.

---

## 1. Set Up the Environment
If you haven't already set up the virtual environment, run:
```bash
python3 -m venv .venv
.venv/bin/pip install -r backend_api/requirements.txt -r ai_vision/requirements.txt
```

---

## 2. Step 1: Define Parking Slots (Interactively)
Open the video frame and click the 4 corners of each parking slot polygon to define them:
```bash
export QT_QPA_PLATFORM=xcb
.venv/bin/python -m ai_vision.select_slots --video ai_vision/assets/IMG_0772.MOV --output ai_vision/assets/parking_slots.json
```
* **Controls**:
  * Click to draw 4 points per slot.
  * Press **`s`** to save coordinates and exit.
  * Press **`r`** to reset.
  * Press **`c`** to cancel.

---

## 3. Step 2: Run AI Occupancy Detection
Run the AI vision agent to detect cars and display the overlay in a resizable window:
```bash
export QT_QPA_PLATFORM=xcb
.venv/bin/python -m ai_vision.vision_agent --video ai_vision/assets/IMG_0772.MOV --slots ai_vision/assets/parking_slots.json --model yolov8s.pt --debug
```
* **Controls**:
  * Drag display borders with your mouse to resize the window as needed.
  * Press **`q`** in the window to stop/exit.
