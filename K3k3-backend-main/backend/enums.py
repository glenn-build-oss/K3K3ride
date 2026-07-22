import enum

class UserRole(enum.Enum):
    passenger = "passenger"
    driver = "driver"
    admin = "admin"

class TripStatus(enum.Enum):
    requested = "requested"
    accepted = "accepted"
    ongoing = "ongoing"
    completed = "completed"
    canceled = "canceled"

class PaymentStatus(enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"