from sqlalchemy import Column, Integer, String
from geoalchemy2 import Geometry
from database import Base

class IDriver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    status = Column(String, default="Offline")
    location = Column(Geometry("POINT"))

class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    rider_name= Column(String)
    driver_id = Column(Integer, nullable=True)
    status = Column(String)
    pickup = Column(Geometry("POINT"))
    destination = Column(Geometry("POINT"))