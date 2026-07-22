from orm import ORMBase
from decimal import Decimal
from typing import Optional
from datetime import datetime
from pydantic import Field
from enum import Enum


class GenderType(str, Enum):
    male = "male"
    female = "female"
    other = "other"


class RiderApprovalStatus(str, Enum):
    pending = "pending"
    active = "active"
    declined = "declined"


# --- Base Schema ---
class RiderBase(ORMBase):
    gender: Optional[GenderType] = None
    is_available: bool = False


# --- Create Schema ---
class RiderCreate(RiderBase):
    user_id: int


# --- Update Schema ---
class RiderUpdate(ORMBase):
    gender: Optional[GenderType] = None
    is_available: Optional[bool] = None


# --- Location Update Schema ---
class RiderLocationUpdate(ORMBase):
    current_lat: float = Field(..., ge=-90, le=90)
    current_lng: float = Field(..., ge=-180, le=180)


# --- Rating Update Schema ---
class RiderRatingUpdate(ORMBase):
    rating: Decimal = Field(..., ge=0, le=5, decimal_places=2)


# --- Read Schema ---
class RiderRead(RiderBase):
    id: int
    rider_id: str
    user_id: int
    public_id: str
    approval_status: RiderApprovalStatus
    rating: Decimal = Field(ge=0, le=5, decimal_places=2)
    rating_count: int
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    location_updated_at: Optional[datetime] = None


# --- Detail Read Schema (with nested relations) ---
# class RiderDetailRead(RiderRead):
#     vehicle: Optional["VehicleRead"] = None