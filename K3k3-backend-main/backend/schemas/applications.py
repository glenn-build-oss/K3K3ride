from pydantic import BaseModel, ConfigDict
from typing import Optional
from enum import Enum


class ApplicationStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


# --- Base Schema ---
class ApplicationBase(BaseModel):
    residential_address: str
    nationality: str
    country: str
    comment: str
    experience: str


# --- Create Schema ---
class ApplicationCreate(ApplicationBase):
    rider_id: int
    vehicle_id: int
    public_id: Optional[str] = None


# --- Update Schema ---
class ApplicationUpdate(BaseModel):
    residential_address: Optional[str] = None
    nationality: Optional[str] = None
    country: Optional[str] = None
    comment: Optional[str] = None
    experience: Optional[str] = None
    vehicle_id: Optional[int] = None


# --- Status Update Schema ---
class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    

# --- Response Schema ---
class ApplicationResponse(ApplicationBase):
    id: int
    rider_id: int
    vehicle_id: int
    public_id: Optional[str] = None
    status: ApplicationStatus

    model_config = ConfigDict(from_attributes=True)


# --- List Response Schema ---
class ApplicationListResponse(BaseModel):
    total: int
    applications: list[ApplicationResponse]
