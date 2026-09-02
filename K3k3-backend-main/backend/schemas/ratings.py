from orm import ORMBase
from decimal import Decimal
from typing import Optional
from datetime import datetime
from pydantic import Field
from enum import Enum

# --- Base Schema ---
class RatingBase(ORMBase):
    trip_id: int
    rater_id: int
    ratee_id: int
    rating: Decimal = Field(..., ge=0, le=5, decimal_places=2)
    comment: Optional[str] = None

# --- Create Schema ---
class RatingCreate(RatingBase):
    pass

# --- Update Schema ---
class RatingUpdate(ORMBase):
    rating: Optional[Decimal] = Field(None, ge=0, le=5, decimal_places=2)
    comment: Optional[str] = None

# --- Read Schema ---
class RatingRead(RatingBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None