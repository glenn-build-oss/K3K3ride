from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from models.models import Passenger, User
from schemas import passanger
from utils.hashcode import hash_password
import logging
from typing import List

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/passengers", tags=["passengers"])

@router.get("/", response_model=List[passanger.PassengerRead])
def get_passengers(db:Session = Depends(get_db)):
    """Retrieve Passengers"""
    try:
        return db.query(Passenger).all()
    except SQLAlchemyError as e:
        logger.error(f"Database error retrieving passengers: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error retrieving passengers: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.post("/register/", response_model=passanger.PassengerRead)
def create_passenger(passenger_data: passanger.PassengerCreate, db: Session = Depends(get_db)):
    """Register a new passenger with user account."""
    try:
        # Create user first
        db_user = db.query(User).filter(User.email == passenger_data.email).first()
        if db_user:
            logger.warning(f"Passenger registration attempt with existing email: {passenger_data.email}")
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Hash password
        try:
            hashed_pw = hash_password(passenger_data.password)
        except Exception as e:
            logger.error(f"Password hashing failed: {e}")
            raise HTTPException(status_code=500, detail="Password processing failed")
        
        new_user = User(
            name=passenger_data.name,
            email=passenger_data.email,
            phone=passenger_data.phone,
            password=hashed_pw,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
      
        
        # Create passenger entry
        try:
            new_passenger = Passenger(
                user_id=new_user.id,
                current_lat=passenger_data.current_lat,
                current_lng=passenger_data.current_lng,
                gender=str(passenger_data.gender).lower()
            )
            db.add(new_passenger)
            db.commit()
            db.refresh(new_passenger)
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create passenger entry for user {new_user.id}: {e}")
            raise HTTPException(status_code=500, detail="Failed to create passenger entry")
        
        logger.info(f"Passenger registered successfully: {passenger_data.email}")
        return new_passenger
    
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database integrity error during passenger registration: {e}")
        raise HTTPException(status_code=400, detail="Registration failed: Invalid data or duplicate entry")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during passenger registration: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during passenger registration: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.get("/{passenger_id}", response_model=passanger.PassengerRead)
def get_passenger(passenger_id: int, db: Session = Depends(get_db)):
    """Retrieve passenger information by ID."""
    try:
        passenger = db.query(Passenger).filter(Passenger.id == passenger_id).first()
        if not passenger:
            logger.info(f"Passenger not found: {passenger_id}")
            raise HTTPException(status_code=404, detail="Passenger not found")
        return passenger
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error retrieving passenger {passenger_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error retrieving passenger {passenger_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.put("/{passenger_id}", response_model=passanger.PassengerRead)
def update_passenger(passenger_id: int, passenger_data: passanger.PassengerUpdate, db: Session = Depends(get_db)):
    """Update passenger information."""
    try:
        passenger = db.query(Passenger).filter(Passenger.id == passenger_id).first()
        if not passenger:
            logger.info(f"Passenger not found for update: {passenger_id}")
            raise HTTPException(status_code=404, detail="Passenger not found")
        
        update_data = passenger_data.dict(exclude_unset=True)
        for key, value in update_data.items():
            if hasattr(passenger, key):
                setattr(passenger, key, value)
        
        db.add(passenger)
        db.commit()
        db.refresh(passenger)
        
        logger.info(f"Passenger {passenger_id} updated successfully")
        return passenger
    
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error updating passenger {passenger_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error updating passenger {passenger_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

# --------------------------------------------
# Delete passenger endpoint
# --------------------------------------------
@router.delete("/{passenger_id}")
def delete_passenger(passenger_id: int, db: Session = Depends(get_db)): 
    """Delete a passenger by ID."""
    try:
        passenger = db.query(Passenger).filter(Passenger.id == passenger_id).first()
        if not passenger:
            logger.info(f"Passenger not found for deletion: {passenger_id}")
            raise HTTPException(status_code=404, detail="Passenger not found")
        
        db.delete(passenger)
        db.commit()
        
        logger.info(f"Passenger {passenger_id} deleted successfully")
        return {"detail": "Passenger deleted successfully"}
    
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error deleting passenger {passenger_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error deleting passenger {passenger_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")