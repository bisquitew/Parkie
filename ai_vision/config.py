import os
from dotenv import load_dotenv

load_dotenv()

class VisionConfig:
    BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
    LOT_ID = os.getenv("LOT_ID")
    MODEL_PATH = os.getenv("MODEL_PATH", "yolo11m.pt")
    
    # Detection classes for cars/vehicles (COCO indices)
    # 2: car, 3: motorcycle, 5: bus, 7: truck, 1: bicycle
    VEHICLE_CLASSES = [2, 3, 5, 7, 1]
    
    OCCUPANCY_SMOOTHING = 5
    DEFAULT_CONF = 0.15
    INFERENCE_INTERVAL = 5  # seconds
    REPORT_INTERVAL = 15    # seconds
    
    RETRY_BACKOFF = 5       # seconds to wait before retrying camera
    
config = VisionConfig()
