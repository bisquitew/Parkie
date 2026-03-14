import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from typing import List, Dict
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Parkie")

# Setup CORS: Allow all origins for the React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase Client using environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Pydantic Model for the incoming request payload from the AI component
class DetectionPayload(BaseModel):
    lot_id: str  # This is the UUID
    detected_cars: int

# Pydantic Model for the lot setup from the web dashboard
class LotSetupPayload(BaseModel):
    camera_url: str
    slots_data: List[List[int]]

def get_status_color(capacity: int, available_spots: int) -> str:
    """
    Calculates the marker color based on occupancy percentage:
    - Below 70% occupied: green
    - Between 70% and 85% occupied: yellow
    - Above 85% occupied: red
    """
    if capacity <= 0:
        return "gray"
    
    occupied = capacity - available_spots
    occupancy_rate = (occupied / capacity) * 100
    
    if occupancy_rate < 70:
        return "green"
    elif occupancy_rate <= 85:
        return "yellow"
    else:
        return "red"

@app.post("/update_lot")
async def update_lot(payload: DetectionPayload):
    """
    Accepts JSON with lot_id (UUID) and detected_cars.
    Calculates available_spots, updates Supabase (including last_updated), 
    and returns the new status with the calculated color.
    """
    # Fetch capacity and name to calculate availability and return context
    response = supabase.table("parking_lots").select("name", "capacity").eq("id", payload.lot_id).execute()
    
    # Check if lot exists
    if not response.data:
        raise HTTPException(status_code=404, detail=f"Parking lot with ID '{payload.lot_id}' not found.")
    
    lot_data = response.data[0]
    capacity = lot_data["capacity"]
    name = lot_data["name"]

    # Calculate available spots: capacity - detected_cars
    # Clamp the result at 0 to avoid negative values
    available_spots = max(0, capacity - payload.detected_cars)

    # Update the available_spots and last_updated columns in Supabase
    # Note: Supabase/PostgreSQL usually handles 'last_updated' via triggers, 
    # but we can explicitly set it here for clarity during the hackathon.
    update_response = supabase.table("parking_lots") \
        .update({
            "available_spots": available_spots,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }) \
        .eq("id", payload.lot_id) \
        .execute()

    # Verify update success
    if not update_response.data:
        raise HTTPException(status_code=500, detail="Failed to update database record.")

    # Return success message with the new color and name
    return {
        "status": "success",
        "lot_id": payload.lot_id,
        "name": name,
        "available_spots": available_spots,
        "status_color": get_status_color(capacity, available_spots),
        "last_updated": update_response.data[0].get("last_updated")
    }

@app.get("/lots")
async def get_all_lots():
    """
    Returns all parking lots with full details (id, name, capacity, available_spots, last_updated)
    and the dynamically calculated status_color.
    """
    response = supabase.table("parking_lots").select("*").execute()
    lots = response.data
    
    for lot in lots:
        lot["status_color"] = get_status_color(lot["capacity"], lot["available_spots"])
        
    return lots

@app.get("/lots/colors")
async def get_all_lot_colors() -> List[Dict[str, str]]:
    """
    Returns only the ID and status_color for every lot.
    Perfect for updating map markers efficiently on the frontend.
    """
    response = supabase.table("parking_lots").select("id", "capacity", "available_spots").execute()
    
    colors_only = []
    for lot in response.data:
        colors_only.append({
            "id": lot["id"],
            "status_color": get_status_color(lot["capacity"], lot["available_spots"])
        })
        
    return colors_only

@app.get("/lots/{lot_id}")
async def get_lot(lot_id: str):
    """
    Returns full details for a single parking lot by ID (UUID).
    """
    response = supabase.table("parking_lots").select("*").eq("id", lot_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Parking lot not found.")

    lot = response.data[0]
    lot["status_color"] = get_status_color(lot["capacity"], lot["available_spots"])
    
    return lot

@app.post("/lots/{lot_id}/setup")
async def setup_lot(lot_id: str, payload: LotSetupPayload):
    """
    Saves camera_url and slots_data to the database for a specific lot.
    Updates the capacity based on the number of slots provided.
    """
    # Calculate capacity from the number of slots
    capacity = len(payload.slots_data)
    
    # Update Supabase
    update_response = supabase.table("parking_lots") \
        .update({
            "camera_url": payload.camera_url,
            "slots_data": payload.slots_data,
            "capacity": capacity,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }) \
        .eq("id", lot_id) \
        .execute()

    if not update_response.data:
        raise HTTPException(status_code=404, detail=f"Parking lot with ID '{lot_id}' not found or update failed.")

    return {
        "status": "success",
        "lot_id": lot_id,
        "capacity": capacity,
        "camera_url": payload.camera_url
    }

@app.get("/lots/{lot_id}/config")
async def get_lot_config(lot_id: str):
    """
    Returns the camera_url and slots_data for the YOLO AI script.
    """
    response = supabase.table("parking_lots") \
        .select("camera_url", "slots_data") \
        .eq("id", lot_id) \
        .execute()

    if not response.data:
        raise HTTPException(status_code=404, detail=f"Parking lot with ID '{lot_id}' not found.")

    config = response.data[0]
    
    # Validate that config is not empty (in case columns are null)
    if not config.get("camera_url") or not config.get("slots_data"):
        raise HTTPException(status_code=400, detail="Lot configuration is incomplete. Please run setup first.")

    return config

# Root endpoint for basic health check
@app.get("/")
def read_root():
    return {"message": "Parkie API is online!"}
