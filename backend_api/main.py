import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from typing import Optional
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

# Pydantic Model for the incoming request payload
class DetectionPayload(BaseModel):
    lot_id: str
    detected_cars: int

@app.post("/update_lot")
async def update_lot(payload: DetectionPayload):
    """
    Accepts JSON with lot_id and detected_cars.
    Calculates available_spots and updates the Supabase database.
    """
    
    # 1. Fetch the capacity for the given lot_id from Supabase
    response = supabase.table("parking_lots").select("capacity").eq("id", payload.lot_id).execute()
    
    # Check if lot exists
    if not response.data:
        raise HTTPException(status_code=404, detail=f"Parking lot with ID '{payload.lot_id}' not found.")
    
    capacity = response.data[0]["capacity"]

    # 2. Calculate available spots: capacity - detected_cars
    # Clamp the result at 0 to avoid negative values
    available_spots = max(0, capacity - payload.detected_cars)

    # 3. Update the available_spots column in the Supabase table
    update_response = supabase.table("parking_lots") \
        .update({"available_spots": available_spots}) \
        .eq("id", payload.lot_id) \
        .execute()

    # Verify update success (optional but recommended for a hackathon)
    if not update_response.data:
        raise HTTPException(status_code=500, detail="Failed to update database record.")

    # 4. Return success message
    return {
        "status": "success",
        "lot_id": payload.lot_id,
        "new_available_spots": available_spots,
        "total_capacity": capacity
    }

@app.get("/lots")
async def get_all_lots():
    """
    Fetches all parking lots from Supabase.
    Useful for the React Native app to display all available lots on a map/list.
    """
    response = supabase.table("parking_lots").select("*").execute()
    return response.data

@app.get("/lots/{lot_id}")
async def get_lot(lot_id: str):
    """
    Fetches details for a specific parking lot.
    """
    response = supabase.table("parking_lots").select("*").eq("id", lot_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Parking lot not found.")

    return response.data[0]

# Root endpoint for basic health check
@app.get("/")
def read_root():
    return {"message": "Parkie API is online!"}
