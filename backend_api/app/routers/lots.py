from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Dict, Optional
from uuid import UUID
from datetime import datetime, timezone
from ..db import supabase
from ..models.schemas import LotSetupPayload, LotResponse
from ..services.lot_service import get_status_color
from ..dependencies.auth import get_current_user, TokenData

router = APIRouter(prefix="/lots", tags=["lots"])

@router.get("", response_model=List[Dict])
async def get_all_lots(include_unverified: bool = Query(False)):
    query = supabase.table("parking_lots").select("*")
    if not include_unverified:
        query = query.eq("is_verified", True)
    response = query.execute()
    return response.data

@router.get("/my", response_model=List[Dict])
async def get_my_lots(current_user: TokenData = Depends(get_current_user)):
    try:
        response = supabase.table("parking_lots").select("*").eq("owner_id", current_user.user_id).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")

@router.get("/colors")
async def get_all_lot_colors():
    response = supabase.table("parking_lots") \
        .select("id", "status_color") \
        .eq("is_verified", True) \
        .execute()
    return response.data

@router.get("/{lot_id}")
async def get_lot(lot_id: UUID):
    response = supabase.table("parking_lots").select("*").eq("id", str(lot_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Parking lot not found.")
    return response.data[0]

@router.post("")
async def create_lot(payload: LotSetupPayload, current_user: TokenData = Depends(get_current_user)):
    # Ensure the user is the owner
    if str(payload.owner_id) != current_user.user_id:
        raise HTTPException(status_code=403, detail="Cannot create lot for another owner")

    capacity = payload.capacity if payload.capacity is not None else len(payload.slots_data)
    available_spots = capacity
    status_color = get_status_color(capacity, available_spots)
    
    insert_response = supabase.table("parking_lots") \
        .insert({
            "owner_id": str(payload.owner_id),
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

@router.put("/{lot_id}/setup")
async def setup_lot(lot_id: UUID, payload: LotSetupPayload, current_user: TokenData = Depends(get_current_user)):
    # Check ownership
    lot_check = supabase.table("parking_lots").select("owner_id").eq("id", str(lot_id)).execute()
    if not lot_check.data:
        raise HTTPException(status_code=404, detail="Lot not found")
    if lot_check.data[0]["owner_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not the owner of this lot")

    capacity = payload.capacity if payload.capacity is not None else len(payload.slots_data)
    available_spots = capacity
    status_color = get_status_color(capacity, available_spots)
    
    update_response = supabase.table("parking_lots") \
        .update({
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
        .eq("id", str(lot_id)) \
        .execute()

    if not update_response.data:
        raise HTTPException(status_code=404, detail=f"Parking lot with ID '{lot_id}' not found.")

    return {
        "status": "success",
        "lot_id": lot_id,
        "message": "Lot configuration updated. Pending admin re-verification."
    }

@router.get("/{lot_id}/config")
async def get_lot_config(lot_id: UUID):
    response = supabase.table("parking_lots") \
        .select("camera_url", "slots_data") \
        .eq("id", str(lot_id)) \
        .execute()

    if not response.data:
        raise HTTPException(status_code=404, detail=f"Parking lot with ID '{lot_id}' not found.")

    config = response.data[0]
    if not config.get("camera_url") or not config.get("slots_data"):
        raise HTTPException(status_code=400, detail="Lot configuration is incomplete.")

    return config
