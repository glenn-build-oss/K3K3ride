"""
Rider Applications API
Handles incoming applications from the apply-to-ride form.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func, text
from database import get_db
from models.models import (
    RiderApplication, RiderApplicationStatus,
    User, Rider, Vehicle, RoleType, RiderApprovalStatus, GenderType
)
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import logging
import os
import shutil
import uuid

# Import shared utilities
try:
    from utils.hashcode import hash_password
    from utils.id_generator import generate_id
except ImportError:
    import hashlib, random
    def hash_password(pw): return hashlib.sha256(pw.encode()).hexdigest()
    def generate_id(prefix): return f"{prefix}-{str(random.randint(0,999999)).zfill(6)}"

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/applications", tags=["Rider Applications"])


# Directory for uploaded documents
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), '..', 'uploads')
os.makedirs(UPLOADS_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class RiderApplicationCreate(BaseModel):
    first_name:                 str
    last_name:                  str
    email:                      str
    phone:                      str
    date_of_birth:              Optional[str] = None
    gender:                     Optional[str] = None
    nationality:                Optional[str] = None
    address:                    Optional[str] = None
    city:                       Optional[str] = None
    about:                      Optional[str] = None
    license_number:             Optional[str] = None
    license_expiry:             Optional[str] = None
    ghana_card_number:          Optional[str] = None
    vehicle_type:               Optional[str] = None
    vehicle_make:               Optional[str] = None
    vehicle_model:              Optional[str] = None
    vehicle_year:               Optional[str] = None
    vehicle_plate:              Optional[str] = None
    vehicle_color:              Optional[str] = None
    experience:                 Optional[str] = None
    insurance_provider:         Optional[str] = None
    insurance_expiry:           Optional[str] = None
    emergency_contact_name:     Optional[str] = None
    emergency_contact_phone:    Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    bank_name:                  Optional[str] = None
    account_number:             Optional[str] = None


class RiderApplicationRead(BaseModel):
    id:                         int
    app_ref:                    str
    first_name:                 str
    last_name:                  str
    email:                      str
    phone:                      str
    date_of_birth:              Optional[str]
    gender:                     Optional[str]
    nationality:                Optional[str]
    address:                    Optional[str]
    city:                       Optional[str]
    about:                      Optional[str]
    license_number:             Optional[str]
    license_expiry:             Optional[str]
    ghana_card_number:          Optional[str]
    vehicle_type:               Optional[str]
    vehicle_make:               Optional[str]
    vehicle_model:              Optional[str]
    vehicle_year:               Optional[str]
    vehicle_plate:              Optional[str]
    vehicle_color:              Optional[str]
    experience:                 Optional[str]
    insurance_provider:         Optional[str]
    insurance_expiry:           Optional[str]
    emergency_contact_name:     Optional[str]
    emergency_contact_phone:    Optional[str]
    emergency_contact_relation: Optional[str]
    bank_name:                  Optional[str]
    account_number:             Optional[str]
    status:                     str
    admin_notes:                Optional[str]
    submitted_at:               Optional[datetime]
    reviewed_at:                Optional[datetime]
    approved_rider_id:          Optional[int]
    documents:                  Optional[List[dict]] = None

    class Config:
        from_attributes = True


class ApplicationStatusUpdate(BaseModel):
    status:      str   # "approved" | "rejected" | "reviewing"
    admin_notes: Optional[str] = None
    reviewed_by: Optional[str] = "Admin"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _next_app_ref(db: Session) -> str:
    count = db.query(func.count(RiderApplication.id)).scalar() or 0
    return f"K3PA-{str(count + 1).zfill(6)}"


def _app_upload_dir(app_id: int) -> str:
    """Return (and create) the upload directory for a given application id."""
    d = os.path.join(UPLOADS_DIR, str(app_id))
    os.makedirs(d, exist_ok=True)
    return d


def _get_documents(app_id: int) -> List[dict]:
    """Return a list of document metadata dicts for an application."""
    upload_dir = os.path.join(UPLOADS_DIR, str(app_id))
    if not os.path.isdir(upload_dir):
        return []
    docs = []
    friendly_names = {
        'riderLicense': "Rider's License",
        'vehicleRegistration': 'Vehicle Registration',
        'insuranceCert': 'Insurance Certificate',
        'idCard': 'National ID Card',
        'passportPhoto': 'Passport Photo',
    }
    for fname in sorted(os.listdir(upload_dir)):
        fpath = os.path.join(upload_dir, fname)
        if not os.path.isfile(fpath):
            continue
        # fname format: {fieldName}_{uuid}.{ext}
        field_key = fname.split('_')[0]
        ext = fname.rsplit('.', 1)[-1].lower() if '.' in fname else ''
        is_image = ext in ('jpg', 'jpeg', 'png', 'gif', 'webp')
        docs.append({
            'filename': fname,
            'field': field_key,
            'name': friendly_names.get(field_key, field_key),
            'url': f'/applications/documents/{app_id}/{fname}',
            'type': 'image' if is_image else 'pdf',
            'icon': 'fa-image' if is_image else 'fa-file-pdf',
        })
    return docs


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/", response_model=RiderApplicationRead)
def submit_application(data: RiderApplicationCreate, db: Session = Depends(get_db)):
    """Submit a new rider application from the apply-to-ride form."""
    try:
        app_ref = _next_app_ref(db)

        application = RiderApplication(
            app_ref=app_ref,
            first_name=data.first_name,
            last_name=data.last_name,
            email=data.email,
            phone=data.phone,
            date_of_birth=data.date_of_birth,
            gender=data.gender,
            nationality=data.nationality,
            address=data.address,
            city=data.city,
            about=data.about,
            license_number=data.license_number,
            license_expiry=data.license_expiry,
            ghana_card_number=data.ghana_card_number,
            vehicle_type=data.vehicle_type,
            vehicle_make=data.vehicle_make,
            vehicle_model=data.vehicle_model,
            vehicle_year=data.vehicle_year,
            vehicle_plate=data.vehicle_plate,
            vehicle_color=data.vehicle_color,
            experience=data.experience,
            insurance_provider=data.insurance_provider,
            insurance_expiry=data.insurance_expiry,
            emergency_contact_name=data.emergency_contact_name,
            emergency_contact_phone=data.emergency_contact_phone,
            emergency_contact_relation=data.emergency_contact_relation,
            bank_name=data.bank_name,
            account_number=data.account_number,
            status=RiderApplicationStatus.pending_review,
        )

        db.add(application)
        db.commit()
        db.refresh(application)

        logger.info(f"New rider application submitted: {app_ref} from {data.email}")
        return application

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"DB error submitting application: {e}")
        raise HTTPException(status_code=500, detail="Database error saving application")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error submitting application: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit application")


@router.get("/", response_model=List[RiderApplicationRead])
def get_all_applications(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all rider applications, optionally filtered by status."""
    try:
        query = db.query(RiderApplication)
        if status and status != "all":
            try:
                status_enum = RiderApplicationStatus(status)
                query = query.filter(RiderApplication.status == status_enum)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
        apps = query.order_by(RiderApplication.submitted_at.desc()).all()
        # Attach documents for each application
        result = []
        for app in apps:
            app_dict = {c.name: getattr(app, c.name) for c in app.__table__.columns}
            app_dict['documents'] = _get_documents(app.id)
            result.append(app_dict)
        return result
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"DB error fetching applications: {e}")
        raise HTTPException(status_code=500, detail="Database error fetching applications")



@router.get("/documents/{app_id}/{filename}")
def serve_document(app_id: int, filename: str):
    """Serve an uploaded document file."""
    filename = os.path.basename(filename)
    file_path = os.path.join(UPLOADS_DIR, str(app_id), filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    ext = filename.rsplit('.', 1)[-1].lower()
    media_types = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'png': 'image/png', 'gif': 'image/gif',
        'webp': 'image/webp', 'pdf': 'application/pdf'
    }
    return FileResponse(file_path, media_type=media_types.get(ext, 'application/octet-stream'))


@router.get("/{app_id}", response_model=RiderApplicationRead)
def get_application(app_id: int, db: Session = Depends(get_db)):
    """Get a single application by ID."""
    app = db.query(RiderApplication).filter(RiderApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.patch("/{app_id}/status", response_model=RiderApplicationRead)
def update_application_status(
    app_id: int,
    update: ApplicationStatusUpdate,
    db: Session = Depends(get_db)
):
    """Update the status of an application (approve / reject / reviewing)."""
    try:
        app = db.query(RiderApplication).filter(RiderApplication.id == app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")

        try:
            app.status = RiderApplicationStatus(update.status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {update.status}")

        if update.admin_notes:
            app.admin_notes = update.admin_notes
        if update.reviewed_by:
            app.reviewed_by = update.reviewed_by
        app.reviewed_at = datetime.utcnow()

        db.commit()
        db.refresh(app)

        logger.info(f"Application {app_id} status updated to {update.status} by {update.reviewed_by}")
        return app

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"DB error updating application status: {e}")
        raise HTTPException(status_code=500, detail="Database error updating status")


@router.get("/stats/summary")
def get_applications_stats(db: Session = Depends(get_db)):
    """Get application counts by status for the admin dashboard."""
    try:
        total    = db.query(func.count(RiderApplication.id)).scalar() or 0
        pending  = db.query(func.count(RiderApplication.id)).filter(RiderApplication.status == RiderApplicationStatus.pending_review).scalar() or 0
        approved = db.query(func.count(RiderApplication.id)).filter(RiderApplication.status == RiderApplicationStatus.approved).scalar() or 0
        rejected = db.query(func.count(RiderApplication.id)).filter(RiderApplication.status == RiderApplicationStatus.rejected).scalar() or 0
        return {"total": total, "pending": pending, "approved": approved, "rejected": rejected}
    except SQLAlchemyError as e:
        logger.error(f"DB error fetching stats: {e}")
        raise HTTPException(status_code=500, detail="Database error fetching stats")


# ---------------------------------------------------------------------------
# Document upload & retrieval
# ---------------------------------------------------------------------------

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'pdf', 'gif', 'webp'}
ALLOWED_FIELD_NAMES = {'riderLicense', 'vehicleRegistration', 'insuranceCert', 'idCard', 'passportPhoto'}


@router.post("/{app_id}/documents")
async def upload_documents(
    app_id: int,
    riderLicense: Optional[UploadFile] = File(None),
    vehicleRegistration: Optional[UploadFile] = File(None),
    insuranceCert: Optional[UploadFile] = File(None),
    idCard: Optional[UploadFile] = File(None),
    passportPhoto: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """Upload documents for a rider application."""
    app = db.query(RiderApplication).filter(RiderApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    upload_dir = _app_upload_dir(app_id)
    files_map = {
        'riderLicense': riderLicense,
        'vehicleRegistration': vehicleRegistration,
        'insuranceCert': insuranceCert,
        'idCard': idCard,
        'passportPhoto': passportPhoto,
    }
    saved = []
    for field_name, upload_file in files_map.items():
        if upload_file is None or not upload_file.filename:
            continue
        ext = upload_file.filename.rsplit('.', 1)[-1].lower() if '.' in upload_file.filename else ''
        if ext not in ALLOWED_EXTENSIONS:
            continue
        # Remove previous file with same field prefix
        for existing in os.listdir(upload_dir):
            if existing.startswith(field_name + '_'):
                os.remove(os.path.join(upload_dir, existing))
        dest_name = f"{field_name}_{uuid.uuid4().hex[:8]}.{ext}"
        dest_path = os.path.join(upload_dir, dest_name)
        with open(dest_path, 'wb') as f:
            shutil.copyfileobj(upload_file.file, f)
        saved.append(dest_name)
        logger.info(f"Saved document {dest_name} for application {app_id}")

    return {"uploaded": saved, "app_id": app_id}


@router.get("/{app_id}/documents")
def list_documents(app_id: int, db: Session = Depends(get_db)):
    """List all uploaded documents for an application."""
    app = db.query(RiderApplication).filter(RiderApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"documents": _get_documents(app_id)}


# ---------------------------------------------------------------------------
# Approve application → create rider account with K3R ID
# ---------------------------------------------------------------------------

class ApproveResponse(BaseModel):
    rider_id: str         # K3R-XXXXXX
    rider_db_id: int
    first_name: str
    last_name: str
    email: str
    phone: str
    default_password: str  # DOB digits e.g. "19950412"
    must_change_password: bool
    app_ref: str


@router.post("/{app_id}/approve", response_model=ApproveResponse)
def approve_application(
    app_id: int,
    admin_notes: Optional[str] = None,
    reviewed_by: str = "Admin",
    db: Session = Depends(get_db)
):
    """
    Approve a rider application:
    1. Creates a User account (role=rider) with a hashed DOB default password.
    2. Creates a Rider record with a generated K3R-XXXXXX public ID.
    3. Creates a Vehicle record from the application's vehicle data.
    4. Updates the application status to 'approved' and links the rider.
    5. Returns the K3R ID and default password for the admin to communicate.
    """
    try:
        app = db.query(RiderApplication).filter(RiderApplication.id == app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")

        if app.status == RiderApplicationStatus.approved:
            raise HTTPException(status_code=409, detail="Application already approved")

        # ── Default password = DOB digits (YYYYMMDD) or fallback ──
        dob_str = (app.date_of_birth or "").replace("-", "").replace("/", "").strip()
        if not dob_str or len(dob_str) < 6:
            dob_str = "K3K3" + str(app.id).zfill(4)   # safe fallback if no DOB
        hashed_pw = hash_password(dob_str)

        # ── Create User ──
        # Build a safe unique email if not provided
        email = app.email or f"rider_{app.id}@k3k3.local"
        phone = app.phone or f"000{app.id:07d}"

        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user and existing_user.rider:
            # Already approved; return existing
            r = existing_user.rider
            return ApproveResponse(
                rider_id=r.public_id,
                rider_db_id=r.id,
                first_name=existing_user.fname,
                last_name=existing_user.lname,
                email=email,
                phone=phone,
                default_password=dob_str,
                must_change_password=r.must_change_password,
                app_ref=app.app_ref,
            )

        new_user = User(
            fname=app.first_name,
            lname=app.last_name,
            email=email,
            phone=phone,
            dob=None,  # DOB stored as string in application; leave User.dob for now
            password=hashed_pw,
            nationality=app.nationality or "Ghanaian",
            gender=None,
            role_type=RoleType.rider,
            is_active=True,
        )
        db.add(new_user)
        db.flush()  # get new_user.id without committing

        # ── Generate sequential K3R ID ──
        rider_public_id = generate_id("K3R")

        # ── Create Rider ──
        gender_val = None
        if app.gender:
            try:
                gender_val = GenderType(app.gender.lower().replace(" ", "_"))
            except ValueError:
                gender_val = None

        new_rider = Rider(
            user_id=new_user.id,
            rider_id=rider_public_id,
            public_id=rider_public_id,
            approval_status=RiderApprovalStatus.active,
            gender=gender_val,
            is_available=False,
            must_change_password=True,
        )
        db.add(new_rider)
        db.flush()

        # ── Create Vehicle (if data available) ──
        if app.vehicle_make and app.vehicle_model:
            plate = app.vehicle_plate or f"GR-{app.id:04d}-K3"
            new_vehicle = Vehicle(
                rider_id=new_rider.id,
                make=app.vehicle_make,
                model=app.vehicle_model,
                year=int(app.vehicle_year) if app.vehicle_year and app.vehicle_year.isdigit() else 2020,
                plate_number=plate,
                color=app.vehicle_color or "",
                ride_type=app.vehicle_type or "Tricycle",
            )
            db.add(new_vehicle)

        # ── Update application ──
        app.status = RiderApplicationStatus.approved
        app.approved_rider_id = new_rider.id
        app.reviewed_by = reviewed_by
        app.reviewed_at = datetime.utcnow()
        if admin_notes:
            app.admin_notes = admin_notes

        db.commit()
        db.refresh(new_rider)

        logger.info(f"Application {app_id} approved → Rider {rider_public_id} created (user_id={new_user.id})")

        return ApproveResponse(
            rider_id=rider_public_id,
            rider_db_id=new_rider.id,
            first_name=app.first_name,
            last_name=app.last_name,
            email=email,
            phone=phone,
            default_password=dob_str,
            must_change_password=True,
            app_ref=app.app_ref,
        )

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"DB error approving application {app_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error approving application {app_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Approval failed: {e}")


# ---------------------------------------------------------------------------
# Delete application (hard delete + uploaded files)
# ---------------------------------------------------------------------------

@router.delete("/{app_id}", status_code=204)
def delete_application(app_id: int, db: Session = Depends(get_db)):
    """Hard-delete an application and all its uploaded documents."""
    try:
        app = db.query(RiderApplication).filter(RiderApplication.id == app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")

        # Remove uploaded files from disk
        upload_dir = os.path.join(UPLOADS_DIR, str(app_id))
        if os.path.isdir(upload_dir):
            shutil.rmtree(upload_dir, ignore_errors=True)
            logger.info(f"Deleted upload directory for application {app_id}")

        db.delete(app)
        db.commit()
        logger.info(f"Application {app_id} deleted")
        return  # 204 No Content

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"DB error deleting application {app_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error deleting application")
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting application {app_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete application")
