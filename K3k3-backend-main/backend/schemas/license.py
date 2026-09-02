from pydantic import BaseModel, ConfigDict
from typing import Optional


# --- Base Schema ---
class LicenseBase(BaseModel):
    rider_license: Optional[str] = None
    vehicle_registration: Optional[str] = None
    insurance_cert: Optional[str] = None
    national_id_card: Optional[str] = None
    passport_photo: Optional[str] = None


# --- Create Schema ---
class LicenseCreate(LicenseBase):
    vehicle_id: int


# --- Update Schema ---
class LicenseUpdate(LicenseBase):
    pass


# --- Response Schema ---
class LicenseResponse(LicenseBase):
    id: int
    vehicle_id: int

    model_config = ConfigDict(from_attributes=True)


# --- Response with Vehicle ---
# class LicenseWithVehicleResponse(LicenseResponse):
#     vehicle: Optional["VehicleResponse"] = None

#     model_config = ConfigDict(from_attributes=True)