from orm import ORMBase
from pydantic import Field
from typing import Optional
from decimal import Decimal
from datetime import datetime


class TripBase(ORMBase):
    pickup_lat: float = Field(..., ge=-90, le=90)
    pickup_lng: float = Field(..., ge=-180, le=180)
    dest_lat: float = Field(..., ge=-90, le=90)
    dest_lng: float = Field(..., ge=-180, le=180)
    fare_estimate: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    pickup_label: Optional[str] = None
    dest_label: Optional[str] = None


class TripCreate(TripBase):
    passenger_id: int
    rider_id: Optional[int] = None   # assigned later by matching logic


class TripUpdate(ORMBase):
    rider_id: Optional[int] = None
    status: Optional[str] = None
    actual_fare: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    pickup_label: Optional[str] = None
    dest_label: Optional[str] = None


class TripRead(TripBase):
    id: int
    rider_id: Optional[int]
    passenger_id: int
    status: str
    actual_fare: Optional[Decimal]
    requested_at: datetime
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None


class TripPendingRead(ORMBase):
    """Lightweight response for the pending trips list riders poll."""
    id: int
    passenger_id: int
    pickup_lat: float
    pickup_lng: float
    dest_lat: float
    dest_lng: float
    pickup_label: Optional[str] = None
    dest_label: Optional[str] = None
    fare_estimate: Optional[Decimal] = None
    requested_at: datetime
    # Passenger first name (joined)
    passenger_fname: Optional[str] = None
    passenger_rating: Optional[float] = None