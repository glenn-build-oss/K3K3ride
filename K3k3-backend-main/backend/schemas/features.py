from pydantic import BaseModel, ConfigDict
from typing import Optional


# --- Base Schema ---
class FeatureBase(BaseModel):
    feature: str


# --- Create Schema ---
class FeatureCreate(FeatureBase):
    vehicle_id: int


# --- Bulk Create Schema ---
class FeatureBulkCreate(BaseModel):
    vehicle_id: int
    features: list[str]


# --- Update Schema ---
class FeatureUpdate(BaseModel):
    feature: str


# --- Response Schema ---
class FeatureResponse(FeatureBase):
    id: int
    vehicle_id: int

    model_config = ConfigDict(from_attributes=True)


# --- Response with Vehicle ---
# class FeatureWithVehicleResponse(FeatureResponse):
#     vehicle: Optional["VehicleResponse"] = None

#     model_config = ConfigDict(from_attributes=True)