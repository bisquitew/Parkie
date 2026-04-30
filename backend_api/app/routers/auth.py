from fastapi import APIRouter, HTTPException, status
from ..models.schemas import UserSignup, UserLogin, Token
from ..services.auth_service import get_password_hash, verify_password, create_access_token
from ..db import supabase

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register")
async def register(payload: UserSignup):
    existing = supabase.table("users").select("id").eq("email", payload.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    hashed_password = get_password_hash(payload.password)

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

@router.post("/login", response_model=Token)
async def login(payload: UserLogin):
    response = supabase.table("users").select("*").eq("email", payload.email).execute()
    
    if not response.data:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user = response.data[0]

    if not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    access_token = create_access_token(
        data={"sub": user["id"], "role": user.get("role", "owner")}
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "user_id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user.get("role", "owner")
        }
    }
