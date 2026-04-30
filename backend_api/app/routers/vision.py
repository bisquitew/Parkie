import cv2
import base64
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from ..db import supabase
from ..models.schemas import DetectionPayload, CaptureFramePayload
from ..services.lot_service import get_status_color

router = APIRouter(prefix="/vision", tags=["vision"])

@router.post("/update_lot")
async def update_lot(payload: DetectionPayload):
    response = supabase.table("parking_lots").select("name", "capacity").eq("id", str(payload.lot_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail=f"Parking lot with ID '{payload.lot_id}' not found.")
    
    lot_data = response.data[0]
    capacity = lot_data["capacity"]
    name = lot_data["name"]

    available_spots = max(0, capacity - payload.detected_cars)
    status_color = get_status_color(capacity, available_spots)

    update_response = supabase.table("parking_lots") \
        .update({
            "available_spots": available_spots,
            "status_color": status_color,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }) \
        .eq("id", str(payload.lot_id)) \
        .execute()

    if not update_response.data:
        raise HTTPException(status_code=500, detail="Failed to update database record.")

    return {
        "status": "success",
        "lot_id": payload.lot_id,
        "name": name,
        "available_spots": available_spots,
        "status_color": status_color,
        "last_updated": update_response.data[0].get("last_updated")
    }

@router.post("/capture_frame")
async def capture_frame(payload: CaptureFramePayload):
    cap = cv2.VideoCapture(payload.camera_url)
    if not cap.isOpened():
        raise HTTPException(status_code=400, detail="Could not open camera stream.")
    
    success, frame = cap.read()
    cap.release()
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to capture frame from camera.")
    
    _, buffer = cv2.imencode('.jpg', frame)
    base64_image = base64.b64encode(buffer).decode('utf-8')
    
    return {"image": f"data:image/jpeg;base64,{base64_image}"}
