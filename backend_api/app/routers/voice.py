import os
import requests as http_requests
from fastapi import APIRouter, HTTPException, UploadFile, File
from datetime import datetime
from ..services.voice_service import transcribe_audio

router = APIRouter(prefix="/search", tags=["voice"])

@router.post("/voice")
async def voice_search(audio: UploadFile = File(...)):
    try:
        content = await audio.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Received empty audio file.")

        suffix = os.path.splitext(audio.filename)[1] if audio.filename else ".m4a"
        
        recordings_dir = "recordings"
        os.makedirs(recordings_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"voice_{timestamp}{suffix}"
        perm_path = os.path.join(recordings_dir, filename)
        
        with open(perm_path, "wb") as f:
            f.write(content)

        transcript = transcribe_audio(perm_path, suffix)
        
        # Geocode
        location = None
        try:
            geo_response = http_requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": transcript,
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
            pass

        return {
            "transcript": transcript,
            "location": location
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
