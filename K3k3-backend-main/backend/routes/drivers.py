from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from database import get_db
from models.models import Rider, User, RiderApprovalStatus
from schemas import rider
from services.location import update_driver_location
from services.ws_manager import manager
from utils.id_generator import generate_id
import logging
from typing import List

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/riders", tags=['Riders'])


@router.post("/register/", response_model=rider.RiderRead)
def create_rider(rider_data: rider.RiderCreate, db: Session = Depends(get_db)):
    """Register a new rider. Status is set to pending and awaits admin approval."""
    try:
        # Check if user exists
        user = db.query(User).filter(User.id == rider_data.user_id).first()
        if not user:
            logger.warning(f"Rider registration attempt with non-existent user: {rider_data.user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        
        # Generate unique IDs
        rider_id = generate_id("K3R")
        public_id = generate_id("K3R")
        
        # Create rider with pending approval status
        new_rider = Rider(
            user_id=rider_data.user_id,
            rider_id=rider_id,
            public_id=public_id,
            approval_status=RiderApprovalStatus.pending,
            is_available=rider_data.is_available,
        )
        db.add(new_rider)
        db.commit()
        db.refresh(new_rider)
        
        logger.info(f"Rider registered successfully with user {rider_data.user_id}, public_id: {public_id}, status: pending")
        return new_rider   
    
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during rider registration: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during rider registration: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.get("/", response_model=List[rider.RiderRead])
def get_riders(db:Session = Depends(get_db)):
    """Retrieve Riders"""
    try:
        return db.query(Rider).all()
    except SQLAlchemyError as e:
        logger.error(f"Database error retrieving riders: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error retrieving riders: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.get("/{rider_id}", response_model=rider.RiderRead)
def get_rider(rider_id: int, db: Session = Depends(get_db)):
    """Retrieve rider information by ID."""
    try:
        rider_obj = db.query(Rider).filter(Rider.id == rider_id).first()
        if not rider_obj:
            logger.info(f"Rider not found: {rider_id}")
            raise HTTPException(status_code=404, detail="Rider not found")
        return rider_obj
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error retrieving rider {rider_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error retrieving rider {rider_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.put("/{rider_id}/location")
async def update_location(rider_id: int, lat: float, lng: float, db: Session = Depends(get_db)):
    """Update rider location and notify connected clients."""
    try:
        # Validate coordinates
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            logger.warning(f"Invalid coordinates provided for rider {rider_id}: lat={lat}, lng={lng}")
            raise HTTPException(status_code=400, detail="Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180")
        
        # Get rider
        rider_obj = db.query(Rider).filter(Rider.id == rider_id).first()
        if not rider_obj:
            logger.info(f"Rider not found for location update: {rider_id}")
            raise HTTPException(status_code=404, detail="Rider not found")
        
        # Update location in database
        location_str = f"{lat},{lng}"
        rider_obj.location = location_str #type: ignore
        db.add(rider_obj)
        db.commit()
        db.refresh(rider_obj)
        
        # Update Redis cache
        success = update_driver_location(rider_id, lat, lng)
        if not success:
            logger.warning(f"Failed to update rider {rider_id} location in Redis")
        
        # Notify connected clients
        sent = await manager.send(rider_id, {
            "type": "location_update",
            "rider_id": rider_id,
            "lat": lat,
            "lng": lng
        })
        logger.debug(f"Location update sent to {sent} client(s) for rider {rider_id}")
        
        return {"status": "updated", "clients_notified": sent}
    
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error updating location for rider {rider_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error updating location for rider {rider_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.put("/{rider_id}/availability")
def update_availability(rider_id: int, is_available: bool, db: Session = Depends(get_db)):
    """Update rider availability status."""
    try:
        rider_obj = db.query(Rider).filter(Rider.id == rider_id).first()
        if not rider_obj:
            logger.info(f"Rider not found for availability update: {rider_id}")
            raise HTTPException(status_code=404, detail="Rider not found")
        
        rider_obj.is_available = is_available #type: ignore
        db.add(rider_obj)
        db.commit()
        db.refresh(rider_obj)
        
        logger.info(f"Rider {rider_id} availability set to {is_available}")
        return {"status": "updated", "is_available": is_available}
    
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error updating availability for rider {rider_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error updating availability for rider {rider_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

# --------------------------------------------
# Delete rider endpoint
# --------------------------------------------
@router.delete("/{rider_id}")
def delete_rider(rider_id: int, db: Session = Depends(get_db)): 
    """Delete a rider by ID."""
    try:
        rider_obj = db.query(Rider).filter(Rider.id == rider_id).first()
        if not rider_obj:
            logger.info(f"Rider not found for deletion: {rider_id}")
            raise HTTPException(status_code=404, detail="Rider not found")
        
        db.delete(rider_obj)
        db.commit()
        
        logger.info(f"Rider deleted successfully: {rider_id}")
        return {"detail": "Rider deleted successfully"}
    
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during rider deletion: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during rider deletion: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")