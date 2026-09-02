from typing import Optional
from orm import ORMBase
from pydantic import BaseModel, Field


class AdminBase(ORMBase):
    name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=1)
    phone: str = Field(..., min_length=7, max_length=20)
    password: str = Field(..., min_length=8, description="Plain-text password (will be hashed before storage)")
    role_type: str = Field(..., min_length=1, max_length=10)
    gender: Optional[str] = None
    is_active: bool = True


class AdminCreate(AdminBase):
    pass
    

class AdminUpdate(AdminCreate):
    pass

class AdminRead(AdminBase):
    id: int

class AdminLogin(ORMBase):
    email: str
    password: str


# ---- Rider Approval (creates User + Rider in DB) ----
class RiderApprovalRequest(BaseModel):
    """Payload sent when admin approves a rider application."""
    firstName: str
    lastName: str
    email: str
    phone: str
    dateOfBirth: str          # "YYYY-MM-DD" or "DD-MM-YYYY"
    gender: Optional[str] = "prefer_not_to_say"
    nationality: Optional[str] = "Ghanaian"
    application_db_id: Optional[int] = None   # ID of the rider_applications row to mark approved


class RiderApprovalResponse(BaseModel):
    success: bool
    user_id: int
    rider_id: int
    public_id: str            # The generated rider ID used for login (e.g. K3R-000001)
    email: str
    default_password: str     # DOB formatted as DD-MM-YYYY (shown to admin to hand to rider)
    message: str


# ---- Rider Login ----
class RiderLoginRequest(BaseModel):
    """Rider logs in with their generated public_id (or email) + password."""
    identifier: str           # public_id (K3R-XXXXXX) or email
    password: str


class RiderLoginResponse(BaseModel):
    success: bool
    rider_id: int
    user_id: int
    public_id: str
    email: str
    fname: str
    lname: str
    phone: str
    is_first_login: bool      # True if password is still the DOB default
    message: str


# ---- Rider Password Change ----
class RiderPasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)