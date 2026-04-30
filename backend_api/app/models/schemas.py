from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict
from datetime import datetime
from uuid import UUID

class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None

class DetectionPayload(BaseModel):
    lot_id: UUID
    detected_cars: int

class LotSetupPayload(BaseModel):
    owner_id: UUID
    name: str
    latitude: float
    longitude: float
    camera_url: str
    slots_data: List[List[int]]
    capacity: Optional[int] = None

class CaptureFramePayload(BaseModel):
    camera_url: str

class LotAdminSetupPayload(BaseModel):
    camera_url: str
    slots_data: List[List[int]]

class LotResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    latitude: float
    longitude: float
    camera_url: str
    slots_data: List[List[int]]
    capacity: int
    available_spots: int
    status_color: str
    is_verified: bool
    last_updated: Optional[datetime]
