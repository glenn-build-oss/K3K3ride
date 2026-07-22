import enum

from database import Base

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Date,
    Text,
    JSON,
    UniqueConstraint
)
# from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class RoleType(str, enum.Enum):
    rider = "rider"
    passenger = "passenger"
    admin = "admin"


class TripStatus(str, enum.Enum):
    requested = "requested"
    accepted = "accepted"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class GenderType(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"
    prefer_not_to_say = "prefer_not_to_say"

class ApplicationStatus(str, enum.Enum):
    active = "active"
    pending = "pending"
    suspended = "suspended"


class RiderApprovalStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    declined = "declined"


# ---------------------------------------------------------------------------
# User  (role_type lives here now — Role table dropped)
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    fname       = Column(String(255), nullable=False)
    lname       = Column(String(255), nullable=False)
    email       = Column(String(255), unique=True, nullable=False, index=True)
    phone       = Column(String(20),  unique=True, nullable=False, index=True)
    dob         = Column(Date, nullable=True, index=True)
    password    = Column(String(255), nullable=False)
    nationality = Column(String(255), nullable=True, index=True)
    gender      = Column(Enum(GenderType), nullable=True)  # ← moved from Passenger for easier access in auth
    role_type   = Column(Enum(RoleType), nullable=False, index=True)   # ← was a whole table
    is_active   = Column(Boolean, default=True, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    rider     = relationship("Rider",     back_populates="user", uselist=False, cascade="all, delete-orphan")
    passenger = relationship("Passenger", back_populates="user", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("fname", "lname", name = "_user_full_name_uc"),
    )


    def __repr__(self) -> str:
        return f"<User id={self.id} role={self.role_type} email={self.email!r}>"


# ---------------------------------------------------------------------------
# Rider
# ---------------------------------------------------------------------------

class Rider(Base):
    __tablename__ = "riders"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    rider_id   = Column(String, index=True, nullable=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    public_id   = Column(String, index=True, unique=True, nullable=False)  # ← Generated ID for public use
    approval_status = Column(Enum(RiderApprovalStatus), nullable=False, default=RiderApprovalStatus.pending, index=True)  # ← Approval workflow
    rating      = Column(Numeric(3, 2), default=5.00, nullable=False)
    rating_count = Column(Integer, default=0, nullable=False)   # needed to recompute average correctly
    gender      = Column(Enum(GenderType), nullable=True)
    is_available = Column(Boolean, default=False, nullable=False)
    must_change_password = Column(Boolean, default=True, nullable=False)  # Force password change on first login
    current_lat  = Column(Float, nullable=True)                 # ← was String "lat,lng"
    current_lng  = Column(Float, nullable=True)
    location_updated_at = Column(DateTime(timezone=True), nullable=True)  # staleness tracking

    # Relationships
    user    = relationship("User",    back_populates="rider",   uselist=False)
    vehicle = relationship("Vehicle", back_populates="rider",   uselist=False, cascade="all, delete-orphan")
    trips   = relationship("Trip",    back_populates="rider",   foreign_keys="Trip.rider_id")
    applications = relationship("Application", back_populates="rider")

    __table_args__ = (
        # Composite index: proximity queries always filter available riders first
        Index("ix_riders_available_lat_lng", "is_available", "current_lat", "current_lng"),
    )

    def __repr__(self) -> str:
        return f"<Rider id={self.id} available={self.is_available}>"


# ---------------------------------------------------------------------------
# Passenger
# ---------------------------------------------------------------------------

class Passenger(Base):
    __tablename__ = "passengers"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    gender      = Column(Enum(GenderType), nullable=True)
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)

    # Relationships
    user  = relationship("User", back_populates="passenger", uselist=False)
    trips = relationship("Trip", back_populates="passenger", foreign_keys="Trip.passenger_id")

    def __repr__(self) -> str:
        return f"<Passenger id={self.id}>"


# ---------------------------------------------------------------------------
# Admin  
# ---------------------------------------------------------------------------

class Admin(Base):
    __tablename__ = "admins"

    id      = Column(Integer, primary_key=True, autoincrement=True)
    name    = Column(String(255), nullable=True)  # Optional, can be null
    email   = Column(String(255), nullable=True)  # Optional, can be null
    phone   = Column(String(20), nullable=True)   # Optional, can be null
    password = Column(String(255), nullable=True)  # Optional, can be null
    role_type    = Column(String(50), nullable=True) 
    is_active = Column(Boolean, default=True, nullable=False)
    gender = Column(Enum(GenderType), nullable=True)  # Optional, can be null
    
    

    def __repr__(self) -> str:
        return f"<Admin id={self.id}>"


# ---------------------------------------------------------------------------
# Trips
# ---------------------------------------------------------------------------

class Trip(Base):
    __tablename__ = "trips"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    rider_id     = Column(Integer, ForeignKey("riders.id",     ondelete="SET NULL"), nullable=True)
    passenger_id = Column(Integer, ForeignKey("passengers.id", ondelete="SET NULL"), nullable=True)

    pickup_lat = Column(Float, nullable=False)
    pickup_lng = Column(Float, nullable=False)
    dest_lat   = Column(Float, nullable=False)
    dest_lng   = Column(Float, nullable=False)

    # Human-readable location labels (from passenger autocomplete)
    pickup_label = Column(String(255), nullable=True)
    dest_label   = Column(String(255), nullable=True)

    status        = Column(Enum(TripStatus), nullable=False, default=TripStatus.requested)
    fare_estimate = Column(Numeric(10, 2), nullable=True)
    actual_fare   = Column(Numeric(10, 2), nullable=True)

    # Full lifecycle — Log table dropped, no JOIN needed for timestamps
    requested_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    accepted_at   = Column(DateTime(timezone=True), nullable=True)
    started_at    = Column(DateTime(timezone=True), nullable=True)
    completed_at  = Column(DateTime(timezone=True), nullable=True)
    cancelled_at  = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    rider     = relationship("Rider",     back_populates="trips", foreign_keys=[rider_id])
    passenger = relationship("Passenger", back_populates="trips", foreign_keys=[passenger_id])
    ratings   = relationship("Rating", back_populates="trip", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_trips_rider_id",              "rider_id"),
        Index("ix_trips_passenger_id",          "passenger_id"),
        Index("ix_trips_status",                "status"),
        # Composite indexes for the two most common filtered queries
        Index("ix_trips_rider_status",          "rider_id",     "status"),
        Index("ix_trips_passenger_status",      "passenger_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<Trip id={self.id} status={self.status}>"


# ---------------------------------------------------------------------------
# Vehicle  (unchanged — already well designed)
# ---------------------------------------------------------------------------

class Vehicle(Base):
    __tablename__ = "vehicles"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    rider_id       = Column(Integer, ForeignKey("riders.id", ondelete="CASCADE"), nullable=False)
    make           = Column(String(100), nullable=False)
    model          = Column(String(100), nullable=False)
    year           = Column(Integer, nullable=False)
    plate_number   = Column(String(20), unique=True, nullable=False)
    color          = Column(String(50), nullable=True)
    ride_type      = Column(String, nullable=False)

    # Relationships
    rider = relationship("Rider", back_populates="vehicle")
    features = relationship("Feature", back_populates="vehicle", cascade="all, delete-orphan")
    license = relationship("License", back_populates="vehicle", uselist=False, cascade="all, delete-orphan")


    def __repr__(self) -> str:
        return f"<Vehicle id={self.id} plate={self.plate_number!r}>"
    

class Feature(Base):
    __tablename__ = "features"
    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"))
    feature = Column(String)

    # Relation
    vehicle = relationship("Vehicle", back_populates="features")

class License(Base):
    __tablename__ = "license"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False)
    rider_license = Column(String(255))
    vehicle_registration = Column(String(255))
    insurance_cert = Column(String(255))
    national_id_card = Column(String(255))
    passport_photo = Column(String(255))

    # Relationship
    vehicle = relationship("Vehicle", back_populates="license")

    
class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True, autoincrement=True)
    rider_id = Column(Integer, ForeignKey("riders.id", ondelete="CASCADE"), nullable=False)
    vehcle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False)
    public_id = Column(String, index=True)
    residential_address = Column(String, nullable=False)
    nationality = Column(String, nullable=False)
    country = Column(String, nullable=False)
    comment = Column(Text, nullable=False)
    experience = Column(String, nullable=False)
    status = Column(Enum(ApplicationStatus), nullable=False, default=ApplicationStatus.pending)

    # Relationships
    rider = relationship("Rider", back_populates="applications")

    __table_args__ = (
        Index('ix_application_rider_id', "rider_id"),
        Index('ix_application_status', 'status'),
        Index('ix_application_rider_status', 'rider_id', 'status')
    )


# class Payment(Base):
#     __tablename__ = "payments"

#     id = Column(Integer, primary_key=True, index=True)


class Rating(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    rater_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ratee_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Numeric(3, 2), nullable=False)
    comment = Column(Text, nullable=True)

    trip = relationship("Trip", back_populates="ratings")


# ---------------------------------------------------------------------------
# RiderApplication  (raw form data submitted before account creation)
# ---------------------------------------------------------------------------

class RiderApplicationStatus(str, enum.Enum):
    pending_review = "pending_review"
    approved       = "approved"
    rejected       = "rejected"
    reviewing      = "reviewing"


class RiderApplication(Base):
    __tablename__ = "rider_applications"

    id                      = Column(Integer, primary_key=True, autoincrement=True)
    app_ref                 = Column(String(20), unique=True, nullable=False, index=True)  # K3PA-000001

    # Personal info
    first_name              = Column(String(100), nullable=False)
    last_name               = Column(String(100), nullable=False)
    email                   = Column(String(255), nullable=False, index=True)
    phone                   = Column(String(30), nullable=False)
    date_of_birth           = Column(String(20), nullable=True)
    gender                  = Column(String(30), nullable=True)
    nationality             = Column(String(100), nullable=True)
    address                 = Column(String(255), nullable=True)
    city                    = Column(String(100), nullable=True)
    about                   = Column(Text, nullable=True)

    # License / ID
    license_number          = Column(String(100), nullable=True)
    license_expiry          = Column(String(20),  nullable=True)
    ghana_card_number       = Column(String(100), nullable=True)

    # Vehicle info
    vehicle_type            = Column(String(50),  nullable=True)
    vehicle_make            = Column(String(100), nullable=True)
    vehicle_model           = Column(String(100), nullable=True)
    vehicle_year            = Column(String(10),  nullable=True)
    vehicle_plate           = Column(String(30),  nullable=True)
    vehicle_color           = Column(String(50),  nullable=True)
    experience              = Column(String(50),  nullable=True)

    # Insurance
    insurance_provider      = Column(String(100), nullable=True)
    insurance_expiry        = Column(String(20),  nullable=True)

    # Emergency contact
    emergency_contact_name      = Column(String(100), nullable=True)
    emergency_contact_phone     = Column(String(30),  nullable=True)
    emergency_contact_relation  = Column(String(50),  nullable=True)

    # Bank info
    bank_name               = Column(String(100), nullable=True)
    account_number          = Column(String(50),  nullable=True)

    # Status & review
    status                  = Column(Enum(RiderApplicationStatus), nullable=False, default=RiderApplicationStatus.pending_review, index=True)
    admin_notes             = Column(Text, nullable=True)
    reviewed_by             = Column(String(100), nullable=True)

    # Timestamps
    submitted_at            = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reviewed_at             = Column(DateTime(timezone=True), nullable=True)

    # Linked rider account (set after approval)
    approved_rider_id       = Column(Integer, ForeignKey("riders.id", ondelete="SET NULL"), nullable=True)

    # index=True on email, status, and submitted_at columns handles indexing.
    # checkfirst=True in database.create_all prevents duplicate index errors.


    def __repr__(self) -> str:
        return f"<RiderApplication ref={self.app_ref} status={self.status}>"