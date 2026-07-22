from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from database import get_db
from models.models import Rider, RiderApprovalStatus, User
from schemas import rider
import logging
from typing import List

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/riders", tags=['Admin - Riders'])


@router.get("/pending", response_model=List[rider.RiderRead])
def get_pending_riders(db: Session = Depends(get_db)):
    """Get all riders with pending approval status."""
    try:
        pending_riders = db.query(Rider).filter(
            Rider.approval_status == RiderApprovalStatus.pending
        ).all()
        logger.info(f"Retrieved {len(pending_riders)} pending rider applications")
        return pending_riders
    except SQLAlchemyError as e:
        logger.error(f"Database error retrieving pending riders: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error retrieving pending riders: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.get("/approved", response_model=List[rider.RiderRead])
def get_approved_riders(db: Session = Depends(get_db)):
    """Get all riders with active/approved status."""
    try:
        approved_riders = db.query(Rider).filter(
            Rider.approval_status == RiderApprovalStatus.active
        ).all()
        logger.info(f"Retrieved {len(approved_riders)} approved riders")
        return approved_riders
    except SQLAlchemyError as e:
        logger.error(f"Database error retrieving approved riders: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error retrieving approved riders: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.get("/declined", response_model=List[rider.RiderRead])
def get_declined_riders(db: Session = Depends(get_db)):
    """Get all riders with declined status."""
    try:
        declined_riders = db.query(Rider).filter(
            Rider.approval_status == RiderApprovalStatus.declined
        ).all()
        logger.info(f"Retrieved {len(declined_riders)} declined riders")
        return declined_riders
    except SQLAlchemyError as e:
        logger.error(f"Database error retrieving declined riders: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error retrieving declined riders: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.put("/{rider_id}/approve", response_model=rider.RiderRead)
def approve_rider(rider_id: int, db: Session = Depends(get_db)):
    """Approve a pending rider application. Changes status from pending to active."""
    try:
        rider_obj = db.query(Rider).filter(Rider.id == rider_id).first()
        if not rider_obj:
            logger.warning(f"Approval attempt for non-existent rider: {rider_id}")
            raise HTTPException(status_code=404, detail="Rider not found")
        
        # Check if already approved or declined
        if rider_obj.approval_status == RiderApprovalStatus.active:
            logger.warning(f"Approval attempt for already approved rider: {rider_id}")
            raise HTTPException(status_code=400, detail="Rider is already approved")
        elif rider_obj.approval_status == RiderApprovalStatus.declined:
            logger.warning(f"Approval attempt for declined rider: {rider_id}")
            raise HTTPException(status_code=400, detail="Cannot approve a declined rider")
        
        # Update status to active
        rider_obj.approval_status = RiderApprovalStatus.active
        db.commit()
        db.refresh(rider_obj)
        
        logger.info(f"Rider {rider_id} (public_id: {rider_obj.public_id}) approved successfully")
        return rider_obj
    
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during rider approval: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during rider approval: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.put("/{rider_id}/decline", response_model=rider.RiderRead)
def decline_rider(rider_id: int, db: Session = Depends(get_db)):
    """Decline a pending rider application. Changes status from pending to declined."""
    try:
        rider_obj = db.query(Rider).filter(Rider.id == rider_id).first()
        if not rider_obj:
            logger.warning(f"Decline attempt for non-existent rider: {rider_id}")
            raise HTTPException(status_code=404, detail="Rider not found")
        
        # Check if already processed
        if rider_obj.approval_status == RiderApprovalStatus.active:
            logger.warning(f"Decline attempt for already approved rider: {rider_id}")
            raise HTTPException(status_code=400, detail="Cannot decline an approved rider")
        elif rider_obj.approval_status == RiderApprovalStatus.declined:
            logger.warning(f"Decline attempt for already declined rider: {rider_id}")
            raise HTTPException(status_code=400, detail="Rider is already declined")
        
        # Update status to declined
        rider_obj.approval_status = RiderApprovalStatus.declined
        db.commit()
        db.refresh(rider_obj)
        
        logger.info(f"Rider {rider_id} (public_id: {rider_obj.public_id}) declined successfully")
        return rider_obj
    
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during rider decline: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during rider decline: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.get("/{rider_id}/status")
def get_rider_status(rider_id: int, db: Session = Depends(get_db)):
    """Get the approval status of a specific rider."""
    try:
        rider_obj = db.query(Rider).filter(Rider.id == rider_id).first()
        if not rider_obj:
            logger.warning(f"Status check for non-existent rider: {rider_id}")
            raise HTTPException(status_code=404, detail="Rider not found")
        
        user = db.query(User).filter(User.id == rider_obj.user_id).first()
        return {
            "rider_id": rider_obj.id,
            "public_id": rider_obj.public_id,
            "user_email": user.email if user else "Unknown",
            "approval_status": rider_obj.approval_status.value,
            "created_at": rider_obj.created_at if hasattr(rider_obj, 'created_at') else None
        }
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error checking rider status: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error checking rider status: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")
