from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from models.models import Vehicle, Rider
from schemas import vehicle


import logging
from typing import List

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/vehicles", tags=["vehicles"])

# --------------------------------------------
# Get vehicles endpoint
# --------------------------------------------
@router.get("/", response_model=List[vehicle.VehicleRead])
def get_vehicles(db:Session = Depends(get_db)):
    """Retrieve Vehicles"""
    try:
        return db.query(Vehicle).all()
    except SQLAlchemyError as e:
        logger.error(f"Database error retrieving vehicles: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error retrieving vehicles: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

# --------------------------------------------
# Post vehicle endpoint
# --------------------------------------------
@router.post("/register/", response_model=vehicle.VehicleRead)
def create_vehicle(vehicle_data: vehicle.VehicleCreate, db: Session = Depends(get_db)):
    """Register a new vehicle for a rider."""
    try:
        # Check if rider exists
        rider = db.query(Rider).filter(Rider.id == vehicle_data.rider_id).first()
        if not rider:
            logger.warning(f"Vehicle registration attempt with non-existent rider: {vehicle_data.rider_id}")
            raise HTTPException(status_code=404, detail="Rider not found")
        
        # Create vehicle
        new_vehicle = Vehicle(
            rider_id=vehicle_data.rider_id,
            make=vehicle_data.make,
            model=vehicle_data.model,
            year=vehicle_data.year,
            license_plate=vehicle_data.plate_number,
            color=vehicle_data.color
        )
        db.add(new_vehicle)
        db.commit()
        db.refresh(new_vehicle)
        
        logger.info(f"Vehicle registered successfully for rider {vehicle_data.rider_id}")
        return new_vehicle   
    
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during vehicle registration: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during vehicle registration: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

# --------------------------------------------
# Get vehicle endpoint
# --------------------------------------------

@router.get("/{vehicle_id}", response_model=vehicle.VehicleRead)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    """Retrieve vehicle information by ID."""
    try:
        vehicle_obj = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
        if not vehicle_obj:
            logger.warning(f"Vehicle retrieval attempt for non-existent ID: {vehicle_id}")
            raise HTTPException(status_code=404, detail="Vehicle not found")
        return vehicle_obj
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error retrieving vehicle {vehicle_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error retrieving vehicle {vehicle_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

# --------------------------------------------
# Update vehicle endpoint
# --------------------------------------------

@router.put("/{vehicle_id}", response_model=vehicle.VehicleRead)
def update_vehicle(vehicle_id: int, vehicle_data: vehicle.VehicleUpdate, db: Session = Depends(get_db)):
    """Update vehicle information by ID."""
    try:
        vehicle_obj = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
        if not vehicle_obj:
            logger.warning(f"Vehicle update attempt for non-existent ID: {vehicle_id}")
            raise HTTPException(status_code=404, detail="Vehicle not found")
        
        # Update fields
        for field, value in vehicle_data.dict(exclude_unset=True).items():
            setattr(vehicle_obj, field, value)
        
        db.commit()
        db.refresh(vehicle_obj)
        
        logger.info(f"Vehicle updated successfully: {vehicle_id}")
        return vehicle_obj
    
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error updating vehicle {vehicle_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error updating vehicle {vehicle_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")
    
# --------------------------------------------
# Delete vehicle endpoint
# --------------------------------------------

@router.delete("/{vehicle_id}")
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    """Delete a vehicle by ID."""
    try:
        vehicle_obj = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
        if not vehicle_obj:
            logger.warning(f"Vehicle deletion attempt for non-existent ID: {vehicle_id}")
            raise HTTPException(status_code=404, detail="Vehicle not found")
        
        db.delete(vehicle_obj)
        db.commit()
        
        logger.info(f"Vehicle deleted successfully: {vehicle_id}")
        return {"detail": "Vehicle deleted successfully"}
    
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error deleting vehicle {vehicle_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error deleting vehicle {vehicle_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")