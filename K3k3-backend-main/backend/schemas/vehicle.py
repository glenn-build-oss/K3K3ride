from orm import ORMBase
from typing import Optional
from pydantic import Field

from schemas.features import FeatureResponse
from schemas.license import LicenseResponse


# --- Base Schema ---
class VehicleBase(ORMBase):
    make: str = Field(..., max_length=100)
    model: str = Field(..., max_length=100)
    year: int = Field(..., ge=1900, le=2100)
    plate_number: str = Field(..., max_length=20)
    color: Optional[str] = Field(None, max_length=50)
    ride_type: str = Field(..., max_length=100)


# --- Create Schema ---
class VehicleCreate(VehicleBase):
    rider_id: int
    features_id: int
    license_id: int


# --- Update Schema ---
class VehicleUpdate(ORMBase):
    make: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    plate_number: Optional[str] = Field(None, max_length=20)
    color: Optional[str] = Field(None, max_length=50)
    ride_type: Optional[str] = Field(None, max_length=100)
    features_id: Optional[int] = None
    license_id: Optional[int] = None


# --- Read Schema ---
class VehicleRead(VehicleBase):
    id: int
    rider_id: int
    features_id: int
    license_id: int


# --- Detail Read Schema (with nested relations) ---
class VehicleDetailRead(VehicleRead):
    features: Optional[list[FeatureResponse]] = None
    license: Optional[LicenseResponse] = None