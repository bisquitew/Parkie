from fastapi import APIRouter, HTTPException, Depends
from uuid import UUID
from ..db import supabase
from ..dependencies.auth import get_admin_user

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/lots/pending", dependencies=[Depends(get_admin_user)])
async def get_pending_lots():
    response = supabase.table("parking_lots") \
        .select("*") \
        .eq("is_verified", False) \
        .execute()
    return response.data

@router.patch("/lots/{lot_id}/verify", dependencies=[Depends(get_admin_user)])
async def verify_lot(lot_id: UUID, verified: bool = True):
    update_response = supabase.table("parking_lots") \
        .update({"is_verified": verified}) \
        .eq("id", str(lot_id)) \
        .execute()

    if not update_response.data:
        raise HTTPException(status_code=404, detail=f"Parking lot with ID '{lot_id}' not found.")

    return {
        "status": "success",
        "lot_id": lot_id,
        "is_verified": verified,
        "message": "Lot status updated by admin."
    }

@router.delete("/lots/{lot_id}", dependencies=[Depends(get_admin_user)])
async def delete_lot(lot_id: UUID):
    check = supabase.table("parking_lots").select("id").eq("id", str(lot_id)).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail=f"Parking lot with ID '{lot_id}' not found.")
    
    supabase.table("parking_lots").delete().eq("id", str(lot_id)).execute()
    
    return {
        "status": "success",
        "lot_id": lot_id,
        "message": "Parking lot has been rejected and removed."
    }
