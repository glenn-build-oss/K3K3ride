from fastapi import APIRouter, Depends, HTTPException   
from database import get_db
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy import text
from models.models import Admin, User, Rider, RiderApprovalStatus, RoleType, GenderType
from schemas import admin, rider
from schemas import rider as rider_schema
from schemas.admin import RiderApprovalRequest, RiderApprovalResponse, RiderLoginRequest, RiderLoginResponse, RiderPasswordChange
from utils.hashcode import hash_password, verify_password
from utils.id_generator import generate_id
import logging, uuid
from typing import List
from datetime import datetime, date

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/", response_model=List[admin.AdminRead])
def get_admins(db:Session = Depends(get_db)):
    """Retrieve Admins"""
    try:
        return db.query(Admin).all()
    except SQLAlchemyError as e:
        logger.error(f"Database error retrieving admins: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error retrieving admins: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.post("/login", response_model=admin.AdminRead)
def login_admin(admin_data: admin.AdminLogin, db: Session = Depends(get_db)):
    """Authenticate admin and return admin data."""
    try:
        # Find admin by email
        db_admin = db.query(Admin).filter(Admin.email == admin_data.email).first()
        if not db_admin:
            logger.warning(f"Admin login attempt with non-existent email: {admin_data.email}")
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Verify password
        try:
            if not verify_password(admin_data.password, db_admin.password): #type: ignore
                logger.warning(f"Failed admin login attempt for email: {admin_data.email}")
                raise HTTPException(status_code=401, detail="Invalid credentials")
        except Exception as e:
            logger.error(f"Password verification failed for admin {admin_data.email}: {e}")
            raise HTTPException(status_code=500, detail="Authentication failed")
        
        logger.info(f"Admin logged in successfully: {admin_data.email}")
        return db_admin
    
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error during admin login: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error during admin login: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.post("/register/", response_model=admin.AdminRead)
def create_admin(admin_data: admin.AdminCreate, db: Session = Depends(get_db)):
    """Register a new admin user with full admin privileges."""
    try:
        # Check if admin already exists
        existing_admin = db.query(Admin).filter(Admin.email == admin_data.email).first()
        if existing_admin:
            logger.warning(f"Admin registration attempt with existing email: {admin_data.email}")
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Hash password
        try:
            hashed_pw = hash_password(admin_data.password)
        except Exception as e:
            logger.error(f"Password hashing failed: {e}")
            raise HTTPException(status_code=500, detail="Password processing failed")
        
        # Create user
        new_admin = Admin(
            name=admin_data.name,
            email=admin_data.email,
            phone=admin_data.phone,
            password=hashed_pw,
            role_type=admin_data.role_type,
            gender=admin_data.gender,
            is_active=admin_data.is_active
        )
        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)
        
        # Create admin role
    
        
        # Create admin entry
        # try:
        #     new_admin = Admin(user_id=new_user.id)
        #     db.add(new_admin)
        #     db.commit()
        #     db.refresh(new_admin)
        # except Exception as e:
        #     db.rollback()
        #     logger.error(f"Failed to create admin entry for user {new_user.id}: {e}")
        #     raise HTTPException(status_code=500, detail="Failed to create admin entry")
        
        logger.info(f"Admin registered successfully: {admin_data.email}")
        return new_admin
    
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database integrity error during admin registration: {e}")
        raise HTTPException(status_code=400, detail="Registration failed: Invalid data or duplicate entry")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during admin registration: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during admin registration: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

# --------------------------------------------
# Update admin endpoint
# --------------------------------------------
@router.put("/{admin_id}", response_model=admin.AdminRead)
def update_admin(admin_id: int, admin_data: admin.AdminUpdate, db: Session = Depends(get_db)):
    """Update admin information by ID."""
    try:
        admin_obj = db.query(Admin).filter(Admin.id == admin_id).first()
        if not admin_obj:
            logger.warning(f"Admin update attempt for non-existent ID: {admin_id}")
            raise HTTPException(status_code=404, detail="Admin not found")
        
        # Update fields
        admin_obj.name = admin_data.name #type: ignore
        admin_obj.email = admin_data.email #type: ignore
        admin_obj.phone = admin_data.phone #type: ignore
        if admin_data.password:
            try:
                admin_obj.password = hash_password(admin_data.password) #type: ignore
            except Exception as e:
                logger.error(f"Password hashing failed during admin update: {e}")
                raise HTTPException(status_code=500, detail="Password processing failed")
        admin_obj.role_type = admin_data.role_type #type: ignore
        db.commit()
        db.refresh(admin_obj)
        logger.info(f"Admin updated successfully: {admin_id}")
        return admin_obj
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during admin update: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


# ============================================================================
# RIDER APPROVAL MANAGEMENT
# ============================================================================

@router.get("/riders/pending", response_model=List[rider.RiderRead])
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


@router.get("/riders/approved", response_model=List[rider.RiderRead])
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


@router.get("/riders/declined", response_model=List[rider.RiderRead])
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


@router.put("/riders/{rider_id}/approve", response_model=rider.RiderRead)
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


@router.put("/riders/{rider_id}/decline", response_model=rider.RiderRead)
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


@router.get("/riders/{rider_id}/status")
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


# ============================================================================
# RIDER APPROVAL — Creates User + Rider records with DOB as default password
# ============================================================================

def _format_dob_password(dob_str: str) -> str:
    """Convert a date string (YYYY-MM-DD or DD-MM-YYYY) to DD-MM-YYYY password format."""
    try:
        # Try YYYY-MM-DD first
        if len(dob_str) == 10 and dob_str[4] == '-':
            parsed = date.fromisoformat(dob_str)
        else:
            # Try DD-MM-YYYY
            day, month, year = dob_str.split('-')
            parsed = date(int(year), int(month), int(day))
        return parsed.strftime("%d-%m-%Y")
    except Exception:
        return "01-01-1990"


@router.post("/approve-application", response_model=RiderApprovalResponse)
def approve_rider_application(payload: RiderApprovalRequest, db: Session = Depends(get_db)):
    """
    Admin approves a rider application.
    Creates a User (role=rider) and Rider record.
    Default password = Date of Birth formatted as DD-MM-YYYY.
    Returns the generated credentials for the admin to hand to the rider.
    """
    try:
        # Check if user with this email already exists
        existing_user = db.query(User).filter(User.email == payload.email).first()
        if existing_user:
            # Check if they already have a rider record
            existing_rider = db.execute(
                text("SELECT id FROM riders WHERE user_id = :uid"),
                {"uid": existing_user.id}
            ).fetchone()
            if existing_rider:
                raise HTTPException(status_code=400, detail="A rider account for this email already exists")

        # --- Format DOB password ---
        default_password_plain = _format_dob_password(payload.dateOfBirth)
        hashed_pw = hash_password(default_password_plain)

        # --- Map gender string to enum ---
        gender_map = {
            "male": GenderType.male,
            "female": GenderType.female,
            "other": GenderType.other,
            "prefer_not_to_say": GenderType.prefer_not_to_say,
        }
        gender_enum = gender_map.get((payload.gender or "").lower(), GenderType.prefer_not_to_say)

        # --- Parse DOB for user record ---
        try:
            if len(payload.dateOfBirth) == 10 and payload.dateOfBirth[4] == '-':
                dob = date.fromisoformat(payload.dateOfBirth)
            else:
                day, month, year = payload.dateOfBirth.split('-')
                dob = date(int(year), int(month), int(day))
        except Exception:
            dob = None

        # --- Create or reuse User ---
        if existing_user:
            user = existing_user
            # Update password to DOB-based default
            user.password = hashed_pw  # type: ignore
            user.role_type = RoleType.rider  # type: ignore
            db.commit()
            db.refresh(user)
        else:
            user = User(
                fname=payload.firstName,
                lname=payload.lastName,
                email=payload.email,
                phone=payload.phone,
                dob=dob,
                password=hashed_pw,
                nationality=payload.nationality,
                gender=gender_enum,
                role_type=RoleType.rider,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # --- Create Rider record in DB ---
        # The real Postgres riders table has: id, public_id (uuid), user_id, rating, rating_count, gender, is_available
        # We insert without rider_id (column doesn't exist in the real DB schema)
        rider_uuid = str(uuid.uuid4())

        result = db.execute(
            text("""
                INSERT INTO riders (user_id, public_id, rating, rating_count, gender, is_available)
                VALUES (:user_id, :public_id, :rating, :rating_count, :gender, :is_available)
                RETURNING id
            """),
            {
                "user_id": user.id,
                "public_id": rider_uuid,
                "rating": 5.00,
                "rating_count": 0,
                "gender": gender_enum.value,
                "is_available": False,
            }
        )
        db.commit()
        new_rider_id = result.fetchone()[0]

        # Generate a human-readable K3R- display ID from the new rider DB row id
        display_id = f"K3R-{new_rider_id:06d}"

        # --- Also update the rider_applications row if application_db_id was provided ---
        if getattr(payload, 'application_db_id', None):
            try:
                db.execute(
                    text("""
                        UPDATE rider_applications
                        SET status = 'approved',
                            approved_rider_id = :rider_id,
                            admin_notes = :notes,
                            reviewed_at = NOW()
                        WHERE id = :app_id
                    """),
                    {
                        "rider_id": new_rider_id,
                        "app_id": payload.application_db_id,
                        "notes": f"Approved. Rider Login ID: {display_id}. Default password is date of birth."
                    }
                )
                db.commit()
                logger.info(f"Application {payload.application_db_id} marked as approved")
            except Exception as e:
                logger.warning(f"Could not update application row: {e}")

        logger.info(f"Rider approved: user_id={user.id}, display_id={display_id}, db_rider_id={new_rider_id}")

        return RiderApprovalResponse(
            success=True,
            user_id=user.id,
            rider_id=new_rider_id,
            public_id=display_id,
            email=payload.email,
            default_password=default_password_plain,
            message=f"Rider account created. Login ID: {display_id} | Email: {payload.email} | Default password: {default_password_plain}",
        )

    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error during rider approval: {e}")
        raise HTTPException(status_code=400, detail="A user with this email or phone already exists")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during rider approval: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)[:500]}")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during rider approval: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)[:500]}")


# ============================================================================
# RIDER LOGIN — Validate by public_id (or email) + password
# ============================================================================

@router.post("/riders/login", response_model=RiderLoginResponse)
def rider_login(payload: RiderLoginRequest, db: Session = Depends(get_db)):
    """
    Rider login endpoint.
    identifier = email address (riders log in with their email).
    Returns rider session data and whether this is a first login (DOB password still set).
    """
    try:
        # Look up user by email with role_type = rider
        # Use ORM only on User (whose columns all exist in the DB)
        user = db.query(User).filter(
            User.email == payload.identifier,
            User.role_type == RoleType.rider
        ).first()

        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Verify password using Argon2
        if not verify_password(payload.password, user.password):  # type: ignore
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Find rider record using raw SQL (avoids ORM mapping missing columns)
        rider_row = db.execute(
            text("SELECT id FROM riders WHERE user_id = :uid LIMIT 1"),
            {"uid": user.id}
        ).fetchone()

        if not rider_row:
            raise HTTPException(status_code=403, detail="No rider account found. Please contact admin.")

        rider_db_id = rider_row[0]

        # Determine if this is a first login by checking if the password matches the DOB format
        dob_password = ""
        if user.dob:
            dob_password = user.dob.strftime("%d-%m-%Y")
        is_first_login = (payload.password == dob_password) if dob_password else False

        logger.info(f"Rider logged in: user_id={user.id}, display_id=K3R-{user.id:06d}, first_login={is_first_login}")

        return RiderLoginResponse(
            success=True,
            rider_id=rider_db_id,
            user_id=user.id,
            public_id=f"K3R-{user.id:06d}",
            email=user.email,  # type: ignore
            fname=user.fname,  # type: ignore
            lname=user.lname,  # type: ignore
            phone=user.phone,  # type: ignore
            is_first_login=is_first_login,
            message="Login successful",
        )

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error during rider login: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)[:300]}")
    except Exception as e:
        logger.error(f"Unexpected error during rider login: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


# ============================================================================
# RIDER CHANGE PASSWORD
# =========================================================================
@router.put("/riders/{rider_id}/change-password")
def rider_change_password(rider_id: int, payload: RiderPasswordChange, db: Session = Depends(get_db)):
    """
    Allow a rider to change their password.
    rider_id = the DB id from the riders table (returned by login endpoint).
    Verifies current/old password before updating to new hashed password.
    """
    try:
        # Find rider via raw SQL (avoids ORM mapping missing columns)
        rider_row = db.execute(
            text("SELECT id, user_id FROM riders WHERE id = :rid LIMIT 1"),
            {"rid": rider_id}
        ).fetchone()
        if not rider_row:
            raise HTTPException(status_code=404, detail="Rider not found")

        user = db.query(User).filter(User.id == rider_row[1]).first()
        if not user:
            raise HTTPException(status_code=404, detail="Rider user account not found")

        # Accept either 'current_password' or 'old_password' (frontend compat)
        provided_old = payload.current_password or getattr(payload, 'old_password', None)
        if not provided_old:
            raise HTTPException(status_code=400, detail="Current/old password is required")

        # Verify current password
        if not verify_password(provided_old, user.password):  # type: ignore
            raise HTTPException(status_code=401, detail="Current password is incorrect")

        # Update to new hashed password
        user.password = hash_password(payload.new_password)  # type: ignore
        db.commit()

        logger.info(f"Rider id={rider_id} (user_id={user.id}) changed password successfully")
        return {"success": True, "message": "Password changed successfully"}

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during rider password change: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)[:300]}")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during rider password change: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)[:300]}")