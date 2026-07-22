from . import rider, trips, user, passanger
from typing import Optional
from vehicle import VehicleRead

class DriverDetailRead(rider.DriverRead):
    """Driver with their vehicle attached."""
    vehicle: Optional[VehicleRead] = None


class TripDetailRead(trips.TripRead):
    """Trip with nested driver, passenger, and log."""
    driver: Optional[driver.DriverRead] = None # type: ignore
    passenger: Optional[passanger.PassengerRead] = None
    log: Optional[log.LogRead] = None # type: ignore


class UserDetailRead(user.UserRead):
    """User with their role and role-specific profile."""
    role: Optional[role.RoleRead] = None # type: ignore