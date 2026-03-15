import os
import cv2
import base64
import tempfile
import requests as http_requests
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from supabase import create_client, Client
from typing import List, Dict, Optional
from datetime import datetime, timezone
from dotenv import load_dotenv
from passlib.context import CryptContext
from openai import OpenAI

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

# Initialize OpenAI client for Whisper
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

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

class CaptureFramePayload(BaseModel):
    camera_url: str

class LotAdminSetupPayload(BaseModel):
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
        "email": user["email"],
        "role": user.get("role", "owner")
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
        "email": user["email"],
        "role": user.get("role", "owner")
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
    status_color = get_status_color(capacity, available_spots)

    # Update the available_spots, status_color, and last_updated columns in Supabase
    update_response = supabase.table("parking_lots") \
        .update({
            "available_spots": available_spots,
            "status_color": status_color,
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
        "status_color": status_color,
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
    return response.data

@app.get("/my_lots/{owner_id}")
async def get_my_lots(owner_id: str):
    """
    Returns all parking lots owned by a specific user.
    Used by the dashboard.
    """
    try:
        response = supabase.table("parking_lots").select("*").eq("owner_id", owner_id).execute()
        return response.data
    except Exception as e:
        # If owner_id is not a valid UUID or other DB error occurs
        raise HTTPException(status_code=400, detail=f"Invalid owner ID or database error: {str(e)}")

@app.get("/lots/colors")
async def get_all_lot_colors() -> List[Dict[str, str]]:
    """
    Returns only the ID and status_color for every VERIFIED lot.
    """
    response = supabase.table("parking_lots") \
        .select("id", "status_color") \
        .eq("is_verified", True) \
        .execute()
    
    return response.data

@app.get("/lots/pending")
async def get_pending_lots():
    """
    Returns all unverified parking lots for admin review.
    """
    response = supabase.table("parking_lots") \
        .select("*") \
        .eq("is_verified", False) \
        .execute()
    
    return response.data

@app.get("/lots/{lot_id}")
async def get_lot(lot_id: str):
    """
    Returns full details for a single parking lot by ID (UUID).
    """
    response = supabase.table("parking_lots").select("*").eq("id", lot_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Parking lot not found.")

    return response.data[0]

@app.post("/lots")
async def create_lot(payload: LotSetupPayload):
    """
    Registers a new parking lot (Creation).
    Sets is_verified to false for admin review.
    """
    capacity = payload.capacity if payload.capacity is not None else len(payload.slots_data)
    available_spots = capacity
    status_color = get_status_color(capacity, available_spots)
    
    insert_response = supabase.table("parking_lots") \
        .insert({
            "owner_id": payload.owner_id,
            "name": payload.name,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "camera_url": payload.camera_url,
            "slots_data": payload.slots_data,
            "capacity": capacity,
            "available_spots": available_spots,
            "status_color": status_color,
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
    # When setup is updated, we reset availability to full capacity (or re-calculate if needed)
    # For now, let's reset it to capacity as it's a "re-setup"
    available_spots = capacity
    status_color = get_status_color(capacity, available_spots)
    
    update_response = supabase.table("parking_lots") \
        .update({
            "owner_id": payload.owner_id,
            "name": payload.name,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "camera_url": payload.camera_url,
            "slots_data": payload.slots_data,
            "capacity": capacity,
            "available_spots": available_spots,
            "status_color": status_color,
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

@app.post("/capture_frame")
async def capture_frame(payload: CaptureFramePayload):
    """
    Connects to the camera_url, grabs one frame, and returns it as a base64 JPEG.
    """
    cap = cv2.VideoCapture(payload.camera_url)
    if not cap.isOpened():
        raise HTTPException(status_code=400, detail="Could not open camera stream.")
    
    success, frame = cap.read()
    cap.release()
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to capture frame from camera.")
    
    # Encode as JPEG
    _, buffer = cv2.imencode('.jpg', frame)
    base64_image = base64.b64encode(buffer).decode('utf-8')
    
    return {"image": f"data:image/jpeg;base64,{base64_image}"}

@app.post("/lots/{lot_id}/setup")
async def setup_lot_post(lot_id: str, payload: LotAdminSetupPayload):
    """
    Updates the camera_url and slots_data for a specific lot.
    Also updates the capacity based on the number of slots.
    """
    capacity = len(payload.slots_data)
    available_spots = capacity
    status_color = get_status_color(capacity, available_spots)
    
    update_response = supabase.table("parking_lots") \
        .update({
            "camera_url": payload.camera_url,
            "slots_data": payload.slots_data,
            "capacity": capacity,
            "available_spots": available_spots,
            "status_color": status_color,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }) \
        .eq("id", lot_id) \
        .execute()

    if not update_response.data:
        raise HTTPException(status_code=404, detail=f"Parking lot with ID '{lot_id}' not found.")

    return {
        "status": "success",
        "lot_id": lot_id,
        "message": "Lot configuration updated successfully."
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

# --- Admin Endpoints ---

@app.delete("/lots/{lot_id}")
async def delete_lot(lot_id: str):
    """
    Deletes a parking lot (admin rejection).
    """
    # Check if lot exists first
    check = supabase.table("parking_lots").select("id").eq("id", lot_id).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail=f"Parking lot with ID '{lot_id}' not found.")
    
    supabase.table("parking_lots").delete().eq("id", lot_id).execute()
    
    return {
        "status": "success",
        "lot_id": lot_id,
        "message": "Parking lot has been rejected and removed."
    }

# --- Voice Search Endpoint ---

@app.post("/search/voice")
async def voice_search(audio: UploadFile = File(...)):
    """
    Accepts an audio file, transcribes it using OpenAI Whisper (Romanian),
    and geocodes the spoken place name using Nominatim.
    Returns the transcript and location coordinates for the frontend
    to find nearby parking lots.
    """
    if not openai_client:
        raise HTTPException(
            status_code=500,
            detail="OpenAI API key is not configured. Set OPENAI_API_KEY in .env"
        )

    # 1. Save uploaded audio to a recordings folder (Whisper API needs a file-like object)
    try:
        print(f"DEBUG: Received audio file: {audio.filename}, content_type: {audio.content_type}")
        content = await audio.read()
        print(f"DEBUG: Audio content size: {len(content)} bytes")
        
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Received empty audio file.")

        # Determine correct file extension from filename, content-type, or default to .m4a
        suffix = ""
        if audio.filename:
            suffix = os.path.splitext(audio.filename)[1]
        if not suffix and audio.content_type:
            # Map common audio MIME types to extensions
            mime_to_ext = {
                "audio/mp4": ".m4a",
                "audio/x-m4a": ".m4a",
                "audio/m4a": ".m4a",
                "audio/aac": ".aac",
                "audio/mpeg": ".mp3",
                "audio/wav": ".wav",
                "audio/webm": ".webm",
                "audio/ogg": ".ogg",
            }
            suffix = mime_to_ext.get(audio.content_type, "")
        if not suffix:
            suffix = ".m4a"  # Expo records m4a by default
        
        # Save permanently to recordings folder
        recordings_dir = os.path.join(os.path.dirname(__file__), "recordings")
        os.makedirs(recordings_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"voice_{timestamp}{suffix}"
        perm_path = os.path.join(recordings_dir, filename)
        
        with open(perm_path, "wb") as f:
            f.write(content)
        
        print(f"DEBUG: Saved to recordings file: {perm_path}")

        # 2. Transcribe with Whisper
        with open(perm_path, "rb") as audio_file:
            # Wrap the file in a tuple to provide a filename metadata to the multipart request
            # OpenAI prefers audio/mp4 for .m4a files to decode correctly
            file_to_send = (f"recording{suffix}", audio_file, "audio/mp4")
            
            transcription = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=file_to_send,
                language="ro"
            )
        transcript = transcription.text.strip()
        print(f"DEBUG: Original transcript: '{transcript}'")
        
        # Simple post-processing for Romanian numbers often found in place names
        # e.g., "șapte sute" -> "700"
        # We normalize some common diacritic variants for better matching
        normalized_transcript = transcript.lower().replace("ş", "ș").replace("ţ", "ț")
        
        romanian_numbers = {
            "șapte sute": "700",
            "nouă sute": "900",
            "sute": "00",
            "una": "1",
            "două": "2",
            "trei": "3",
            "patru": "4",
            "cinci": "5",
            "șase": "6",
            "șapte": "7",
            "opt": "8",
            "nouă": "9",
            "zece": "10",
        }
        
        processed_transcript = normalized_transcript
        for word, num in romanian_numbers.items():
            processed_transcript = processed_transcript.replace(word, num)
            
        print(f"DEBUG: Processed transcript: '{processed_transcript}'")
        print(f"DEBUG: Transcript successful: '{transcript}'")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    # No cleanup here to keep the files

    # 3. Geocode the transcript using Nominatim (biased toward Romania)
    location = None
    try:
        geo_response = http_requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": processed_transcript,
                "format": "json",
                "limit": 1,
                "countrycodes": "ro",
                "accept-language": "ro"
            },
            headers={"User-Agent": "Parkie/1.0"},
            timeout=5
        )
        geo_data = geo_response.json()
        if geo_data:
            location = {
                "name": geo_data[0].get("display_name", transcript),
                "latitude": float(geo_data[0]["lat"]),
                "longitude": float(geo_data[0]["lon"])
            }
    except Exception:
        # Geocoding is best-effort; if it fails we still return the transcript
        pass

    return {
        "transcript": transcript,
        "location": location
    }

# Root endpoint for basic health check
@app.get("/")
def read_root():
    return {"message": "Parkie API is online!"}
