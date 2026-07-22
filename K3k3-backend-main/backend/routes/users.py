from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from models.models import Admin, RoleType, User, Passenger, Rider, RiderApprovalStatus
from schemas import user
from utils.hashcode import hash_password, verify_password
from utils.id_generator import generate_id
import logging
from typing import List
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["users"])

def create_passenger_for_user(db: Session, user_id: int, gender: str, created_at: datetime=None, updated_at: datetime=None) -> Passenger: #type:ignore
    """Helper function to create a passenger record for a new user."""
    try:
        new_passenger = Passenger(user_id=user_id, gender=gender)
        db.add(new_passenger)
        db.commit()
        db.refresh(new_passenger)
        return new_passenger
    except Exception as e:
        logger.error(f"Failed to create passenger for user {user_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create passenger profile")

def create_rider_for_user(db: Session, user_id: int, gender: str, is_available: bool, created_at: datetime=None, updated_at: datetime=None) -> Rider: #type:ignore
    """Helper function to create a rider record for a new user.
    
    The rider is created with pending approval status and a generated public_id.
    Admin approval is required before the rider can become active.
    """
    try:
        rider_id = generate_id("K3R")
        public_id = generate_id("K3R")
        new_rider = Rider(
            user_id=user_id,
            rider_id=rider_id,
            public_id=public_id,
            approval_status=RiderApprovalStatus.pending,
            gender=gender,
            is_available=is_available
        )
        db.add(new_rider)
        db.commit()
        db.refresh(new_rider)
        logger.info(f"Rider created for user {user_id} with public_id: {public_id}, status: pending")
        return new_rider
    except Exception as e:
        logger.error(f"Failed to create rider for user {user_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create rider profile")



@router.get("/", response_model=List[user.UserRead])
def get_users(db:Session = Depends(get_db)):
    """Retrieve Users"""
    try:
        return db.query(User).all()
    except SQLAlchemyError as e:
        logger.error(f"Database error retrieving users: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error retrieving users: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.post("/register/", response_model=user.UserRead)
def create_user(user_data: user.UserCreate, db: Session = Depends(get_db)):
    """Register a new user with a default role."""
    try:
        # Check if user already exists
        db_user = db.query(User).filter(User.email == user_data.email).first()
        if db_user:
            logger.warning(f"Registration attempt with existing email: {user_data.email}")
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Hash password
        try:
            hashed_pw = hash_password(user_data.password)
        except Exception as e:
            logger.error(f"Password hashing failed: {e}")
            raise HTTPException(status_code=500, detail="Password processing failed")
        
        # Create user
        new_user = User(
            fname=user_data.fname,
            lname=user_data.lname,
            email=user_data.email,
            phone=user_data.phone,
            password=hashed_pw,
            role_type=user_data.role_type,
            is_active=user_data.is_active,
            gender=user_data.gender
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        user_id: int = new_user.id  # type: ignore
        

        # Create passenger or rider or admin profile based on role
        if user_data.role_type == RoleType.passenger:
            create_passenger_for_user(db, user_id, gender=user_data.gender, created_at=datetime.now(), updated_at=datetime.now()) #type: ignore
        elif user_data.role_type == RoleType.rider:
            create_rider_for_user(db, user_id, gender=user_data.gender, is_available=user_data.is_active, created_at=datetime.now(), updated_at=datetime.now())#type: ignore
        else:
            logger.warning(f"Invalid role type provided during registration: {user_data.role_type}")
            raise HTTPException(status_code=400, detail="Invalid role type specified")

        logger.info(f"User registered successfully: {user_data.email}")
        return new_user
    
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database integrity error during registration: {e}")
        raise HTTPException(status_code=400, detail="Registration failed: Invalid data or duplicate entry")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during registration: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during registration: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.post("/login", response_model=user.UserRead)
def login(user_data: user.UserLogin, db: Session = Depends(get_db)):
    """Authenticate user and return user data."""
    try:
        # Find user by email
        db_user = db.query(User).filter(User.email == user_data.email).first()
        if not db_user:
            logger.warning(f"Login attempt with non-existent email: {user_data.email}")
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Verify password
        try:
            if not verify_password(user_data.password, db_user.password): #type: ignore
                logger.warning(f"Failed login attempt for user: {user_data.email}")
                raise HTTPException(status_code=401, detail="Invalid credentials")
        except Exception as e:
            logger.error(f"Password verification failed for user {user_data.email}: {e}")
            raise HTTPException(status_code=500, detail="Authentication failed")
        
        logger.info(f"User logged in successfully: {user_data.email}")
        return db_user
    
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error during login: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error during login: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

# --------------------------------------------
# Update User endpoint
# --------------------------------------------
@router.put("/{user_id}", response_model=user.UserRead)
def update_user(user_id: int, user_data: user.UserUpdate, db: Session = Depends(get_db)):
    """Update user information by ID."""
    try:
        user_obj = db.query(User).filter(User.id == user_id).first()
        if not user_obj:
            logger.warning(f"User update attempt for non-existent ID: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update fields
        for field, value in user_data.dict(exclude_unset=True).items():
            if field == "password":
                try:
                    setattr(user_obj, field, hash_password(value)) #type: ignore
                except Exception as e:
                    logger.error(f"Password hashing failed during user update: {e}")
            else:
                setattr(user_obj, field, value)
        
        db.commit()
        db.refresh(user_obj)
        
        logger.info(f"User updated successfully: {user_id}")
        return user_obj
    
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during user update: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during user update: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")
    
# --------------------------------------------
# Delete user endpoint
# --------------------------------------------
@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Delete a user by ID."""
    try:
        user_obj = db.query(User).filter(User.id == user_id).first()
        if not user_obj:
            logger.warning(f"User deletion attempt for non-existent ID: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        
        db.delete(user_obj)
        db.commit()
        
        logger.info(f"User deleted successfully: {user_id}")
        return {"detail": "User deleted successfully"}
    
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during user deletion: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during user deletion: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")