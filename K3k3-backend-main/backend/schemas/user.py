from orm import ORMBase
from pydantic import Field, EmailStr, field_validator
from typing import Optional
from datetime import datetime, date
from pydantic import BaseModel
from enum import Enum


class GenderType(str, Enum):
    male = "male"
    female = "female"
    other = "other"


class RoleType(str, Enum):
    rider = "rider"
    passenger = "passenger"
    admin = "admin"


# --- Base Schema ---
class UserBase(ORMBase):
    fname: str = Field(..., min_length=1, max_length=255)
    lname: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=20)
    dob: Optional[date] = None
    nationality: Optional[str] = Field(None, max_length=255)
    is_active: bool = True
    gender: Optional[GenderType] = None


# --- Create Schema ---
class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="Plain-text password (will be hashed before storage)")
    role_type: RoleType

    @field_validator("dob")
    @classmethod
    def validate_dob(cls, v: date) -> date:
        if v >= date.today():
            raise ValueError("Date of birth must be in the past")
        return v


# --- Login Schema ---
class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)


# --- Update Schema ---
class UserUpdate(ORMBase):
    fname: Optional[str] = Field(None, min_length=1, max_length=255)
    lname: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=7, max_length=20)
    nationality: Optional[str] = Field(None, max_length=255)
    gender: Optional[GenderType] = None


# --- Password Update Schema ---
class UserPasswordUpdate(BaseModel):
    current_password: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8)


# --- Read Schema ---
class UserRead(ORMBase):
    id: int
    fname: Optional[str] = None
    lname: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[date] = None
    nationality: Optional[str] = None
    is_active: bool = True
    gender: Optional[str] = None
    role_type: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# # --- Detail Read Schema (with nested relations) ---
# class UserDetailRead(UserRead):
#     rider: Optional["RiderRead"] = None
#     passenger: Optional["PassengerRead"] = None