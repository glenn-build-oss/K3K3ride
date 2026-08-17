from typing import Optional
from orm import ORMBase
from pydantic import Field, EmailStr
from datetime import datetime


class PassengerBase(ORMBase):
    current_lat: Optional[float] = Field(None, ge=-90, le=90)
    current_lng: Optional[float] = Field(None, ge=-180, le=180)
    gender: Optional[str] = None



class PassengerCreate(PassengerBase):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=20)
    password: str = Field(..., min_length=8, description="Plain-text password (will be hashed before storage)")
    


class PassengerUpdate(PassengerBase):
    pass


class PassengerRead(PassengerBase):
    id: int
    user_id: int
    