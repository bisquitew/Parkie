import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from supabase import create_client, Client
from typing import List, Dict, Optional
from datetime import datetime, timezone
from dotenv import load_dotenv
from passlib.context import CryptContext

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

# Hashing context for passwords
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Pydantic Models for Users
class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Pydantic Model for the incoming request payload from the AI component
class DetectionPayload(BaseModel):
    lot_id: str  # This is the UUID
    detected_cars: int

# Pydantic Model for the lot setup from the web dashboard (Owner setup)
class LotSetupPayload(BaseModel):
    owner_id: str # The UUID of the owner (from users table)
    name: str
    latitude: float
    longitude: float
    camera_url: str
    slots_data: List[List[int]]  # List of 8-value vectors: [x1, y1, x2, y2, x3, y3, x4, y4]
    capacity: Optional[int] = None # Optional, will default to len(slots_data) if not provided

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

# --- User Management Endpoints ---

@app.post("/register")
async def register(payload: UserSignup):
    """
    Creates a new user account (Lot Owner).
    Hashes the password before storing.
    """
    # Check if user already exists
    existing = supabase.table("users").select("id").eq("email", payload.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    # Hash the password
    hashed_password = pwd_context.hash(payload.password)

    # Insert new user
    insert_response = supabase.table("users").insert({
        "name": payload.name,
        "email": payload.email,
        "password": hashed_password
    }).execute()

    if not insert_response.data:
        raise HTTPException(status_code=500, detail="Failed to register user.")

    user = insert_response.data[0]
    return {
        "status": "success",
        "user_id": user["id"],
        "name": user["name"],
        "email": user["email"]
    }

@app.post("/login")
async def login(payload: UserLogin):
    """
    Authenticates a user and returns their profile.
    For the hackathon, we skip JWT and return user details on success.
    """
    response = supabase.table("users").select("*").eq("email", payload.email).execute()
    
    if not response.data:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user = response.data[0]

    # Verify password
    if not pwd_context.verify(payload.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return {
        "status": "success",
        "user_id": user["id"],
        "name": user["name"],
        "email": user["email"]
    }

# --- Parking Lot Management Endpoints ---

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
    available_spots = max(0, capacity - payload.detected_cars)

    # Update the available_spots and last_updated columns in Supabase
    update_response = supabase.table("parking_lots") \
        .update({
            "available_spots": available_spots,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }) \
        .eq("id", payload.lot_id) \
        .execute()

    if not update_response.data:
        raise HTTPException(status_code=500, detail="Failed to update database record.")

    return {
        "status": "success",
        "lot_id": payload.lot_id,
        "name": name,
        "available_spots": available_spots,
        "status_color": get_status_color(capacity, available_spots),
        "last_updated": update_response.data[0].get("last_updated")
    }

@app.get("/lots")
async def get_all_lots(include_unverified: bool = Query(False)):
    """
    Returns parking lots with full details.
    By default, only returns verified lots for the mobile app.
    Admins can set include_unverified=true to see pending lots.
    """
    query = supabase.table("parking_lots").select("*")
    
    if not include_unverified:
        query = query.eq("is_verified", True)
        
    response = query.execute()
    lots = response.data
    
    for lot in lots:
        lot["status_color"] = get_status_color(lot["capacity"], lot["available_spots"])
        
    return lots

@app.get("/my_lots/{owner_id}")
async def get_my_lots(owner_id: str):
    """
    Returns all parking lots owned by a specific user.
    Used by the dashboard.
    """
    response = supabase.table("parking_lots").select("*").eq("owner_id", owner_id).execute()
    lots = response.data
    
    for lot in lots:
        lot["status_color"] = get_status_color(lot["capacity"], lot["available_spots"])
        
    return lots

@app.get("/lots/colors")
async def get_all_lot_colors() -> List[Dict[str, str]]:
    """
    Returns only the ID and status_color for every VERIFIED lot.
    """
    response = supabase.table("parking_lots") \
        .select("id", "capacity", "available_spots") \
        .eq("is_verified", True) \
        .execute()
    
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

@app.post("/lots")
async def create_lot(payload: LotSetupPayload):
    """
    Registers a new parking lot (Creation).
    Sets is_verified to false for admin review.
    """
    capacity = payload.capacity if payload.capacity is not None else len(payload.slots_data)
    
    insert_response = supabase.table("parking_lots") \
        .insert({
            "owner_id": payload.owner_id,
            "name": payload.name,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "camera_url": payload.camera_url,
            "slots_data": payload.slots_data,
            "capacity": capacity,
            "available_spots": capacity, 
            "is_verified": False,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }) \
        .execute()

    if not insert_response.data:
        raise HTTPException(status_code=500, detail="Failed to create parking lot record.")

    return {
        "status": "success",
        "lot_id": insert_response.data[0]["id"],
        "message": "Lot registered successfully. Pending admin verification."
    }

@app.put("/lots/{lot_id}/setup")
async def setup_lot(lot_id: str, payload: LotSetupPayload):
    """
    Updates details for an existing lot (Re-configuration).
    Resets verification status to false.
    """
    capacity = payload.capacity if payload.capacity is not None else len(payload.slots_data)
    
    update_response = supabase.table("parking_lots") \
        .update({
            "owner_id": payload.owner_id,
            "name": payload.name,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "camera_url": payload.camera_url,
            "slots_data": payload.slots_data,
            "capacity": capacity,
            "is_verified": False, 
            "last_updated": datetime.now(timezone.utc).isoformat()
        }) \
        .eq("id", lot_id) \
        .execute()

    if not update_response.data:
        raise HTTPException(status_code=404, detail=f"Parking lot with ID '{lot_id}' not found.")

    return {
        "status": "success",
        "lot_id": lot_id,
        "message": "Lot configuration updated. Pending admin re-verification."
    }

@app.patch("/lots/{lot_id}/verify")
async def verify_lot(lot_id: str, verified: bool = True):
    """
    Admin endpoint to verify or reject a parking lot.
    Once verified, it will appear on the mobile app.
    """
    update_response = supabase.table("parking_lots") \
        .update({"is_verified": verified}) \
        .eq("id", lot_id) \
        .execute()

    if not update_response.data:
        raise HTTPException(status_code=404, detail=f"Parking lot with ID '{lot_id}' not found.")

    return {
        "status": "success",
        "lot_id": lot_id,
        "is_verified": verified,
        "message": "Lot status updated by admin."
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
    
    if not config.get("camera_url") or not config.get("slots_data"):
        raise HTTPException(status_code=400, detail="Lot configuration is incomplete.")

    return config

# Root endpoint for basic health check
@app.get("/")
def read_root():
    return {"message": "Parkie API is online!"}
