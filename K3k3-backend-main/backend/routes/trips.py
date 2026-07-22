from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from database import get_db
from models.models import Trip, Passenger, Rider, User, TripStatus
from schemas import trips
from services.matching import find_nearest_rider
from services.ws_manager import manager
import logging
from typing import List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/trips", tags=["Trip"])


@router.get("/", response_model=List[trips.TripRead])
def get_trips(db: Session = Depends(get_db)):
    """Retrieve Trips"""
    try:
        return db.query(Trip).all()
    except SQLAlchemyError as e:
        logger.error(f"Database error retrieving trips: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error retrieving trips: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


# ─────────────────────────────────────────────────────────────────
# GET /trips/pending — All unassigned requested trips (riders poll)
# ─────────────────────────────────────────────────────────────────
@router.get("/pending", response_model=List[trips.TripPendingRead])
def get_pending_trips(db: Session = Depends(get_db)):
    """
    Return all trips with status='requested' and no rider assigned.
    Riders poll this endpoint (every 5s when online) to discover new requests.
    """
    try:
        pending = (
            db.query(Trip)
            .options(joinedload(Trip.passenger).joinedload(Passenger.user))
            .filter(
                Trip.status == TripStatus.requested,
                Trip.rider_id.is_(None)
            )
            .order_by(Trip.requested_at.asc())
            .all()
        )

        result = []
        for t in pending:
            pax_fname = None
            pax_rating = None
            if t.passenger and t.passenger.user:
                pax_fname = t.passenger.user.fname

            result.append(trips.TripPendingRead(
                id=t.id,
                passenger_id=t.passenger_id,
                pickup_lat=t.pickup_lat,
                pickup_lng=t.pickup_lng,
                dest_lat=t.dest_lat,
                dest_lng=t.dest_lng,
                pickup_label=t.pickup_label,
                dest_label=t.dest_label,
                fare_estimate=t.fare_estimate,
                requested_at=t.requested_at,
                passenger_fname=pax_fname,
                passenger_rating=pax_rating,
            ))

        logger.info(f"Returning {len(result)} pending unassigned trips")
        return result
    except SQLAlchemyError as e:
        logger.error(f"Database error fetching pending trips: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error fetching pending trips: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.post("/", response_model=trips.TripRead)
async def create_trip(trip_data: trips.TripCreate, db: Session = Depends(get_db)):
    """Create a new trip request and assign to nearest available rider."""
    try:
        # Validate coordinates
        if not (-90 <= trip_data.pickup_lat <= 90 and -180 <= trip_data.pickup_lng <= 180):
            raise HTTPException(status_code=400, detail="Invalid pickup coordinates")

        if not (-90 <= trip_data.dest_lat <= 90 and -180 <= trip_data.dest_lng <= 180):
            raise HTTPException(status_code=400, detail="Invalid destination coordinates")

        # Verify passenger exists
        passenger = db.query(Passenger).filter(Passenger.id == trip_data.passenger_id).first()
        if not passenger:
            raise HTTPException(status_code=404, detail="Passenger not found")

        # Find nearest rider if not specified
        rider_id = trip_data.rider_id
        if rider_id is None:
            rider_id = find_nearest_rider(db, trip_data.pickup_lat, trip_data.pickup_lng)

        # Create trip (rider_id may be None — passengers broadcast to all online riders)
        new_trip = Trip(
            passenger_id=trip_data.passenger_id,
            rider_id=rider_id,
            pickup_lat=trip_data.pickup_lat,
            pickup_lng=trip_data.pickup_lng,
            dest_lat=trip_data.dest_lat,
            dest_lng=trip_data.dest_lng,
            pickup_label=trip_data.pickup_label,
            dest_label=trip_data.dest_label,
            fare_estimate=trip_data.fare_estimate,
            status=TripStatus.requested,
        )
        db.add(new_trip)
        db.commit()
        db.refresh(new_trip)

        # Notify assigned rider (if any) via WebSocket
        if rider_id:
            try:
                await manager.send(rider_id, {
                    "type": "new_trip",
                    "trip_id": new_trip.id,
                    "passenger_id": trip_data.passenger_id,
                    "pickup_label": trip_data.pickup_label,
                    "dest_label": trip_data.dest_label,
                    "pickup": {"lat": trip_data.pickup_lat, "lng": trip_data.pickup_lng},
                    "destination": {"lat": trip_data.dest_lat, "lng": trip_data.dest_lng},
                    "fare_estimate": str(trip_data.fare_estimate) if trip_data.fare_estimate else None,
                })
            except Exception as e:
                logger.error(f"Failed to notify rider about trip {new_trip.id}: {e}")

        logger.info(f"Trip created: id={new_trip.id} pickup='{trip_data.pickup_label}' dest='{trip_data.dest_label}'")
        return new_trip

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during trip creation: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during trip creation: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


# ─────────────────────────────────────────────────────────────────
# PUT /trips/{id}/accept — Rider claims an unassigned trip
# ─────────────────────────────────────────────────────────────────
@router.put("/{trip_id}/accept", response_model=trips.TripRead)
async def accept_trip(trip_id: int, rider_id: int, db: Session = Depends(get_db)):
    """
    Rider accepts a pending trip.
    Sets status='accepted', assigns rider_id, records accepted_at timestamp.
    Broadcasts 'trip_accepted' event to the passenger's WebSocket channel.
    """
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")

        if trip.status != TripStatus.requested:
            raise HTTPException(status_code=409, detail=f"Trip is already {trip.status} — cannot accept")

        if trip.rider_id is not None and trip.rider_id != rider_id:
            raise HTTPException(status_code=409, detail="Trip already claimed by another rider")

        # Claim the trip
        trip.rider_id = rider_id
        trip.status = TripStatus.accepted
        trip.accepted_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(trip)

        # Notify passenger via WebSocket (passenger listens on trip channel)
        try:
            await manager.send(trip_id, {
                "type": "trip_accepted",
                "trip_id": trip_id,
                "rider_id": rider_id,
            })
        except Exception as e:
            logger.warning(f"WS notify passenger failed for trip {trip_id}: {e}")

        logger.info(f"Trip {trip_id} accepted by rider {rider_id}")
        return trip

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"DB error accepting trip {trip_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Error accepting trip {trip_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


# ─────────────────────────────────────────────────────────────────
# PUT /trips/{id}/complete — Rider completes an active trip
# ─────────────────────────────────────────────────────────────────
@router.put("/{trip_id}/complete", response_model=trips.TripRead)
async def complete_trip(trip_id: int, actual_fare: float, db: Session = Depends(get_db)):
    """
    Rider marks a trip as completed.
    Sets status='completed', records completed_at and actual_fare.
    """
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")

        if trip.status not in (TripStatus.accepted, TripStatus.in_progress):
            raise HTTPException(status_code=409, detail=f"Cannot complete trip with status '{trip.status}'")

        trip.status = TripStatus.completed
        trip.actual_fare = actual_fare
        trip.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(trip)

        # Notify passenger
        try:
            await manager.send(trip_id, {
                "type": "trip_completed",
                "trip_id": trip_id,
                "actual_fare": actual_fare,
            })
        except Exception as e:
            logger.warning(f"WS notify for completed trip {trip_id} failed: {e}")

        logger.info(f"Trip {trip_id} completed, fare=₵{actual_fare}")
        return trip

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"DB error completing trip {trip_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Error completing trip {trip_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.get("/{trip_id}", response_model=trips.TripRead)
def get_trip(trip_id: int, db: Session = Depends(get_db)):
    """Retrieve trip information by ID."""
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        return trip
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error retrieving trip {trip_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error retrieving trip {trip_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.put("/{trip_id}", response_model=trips.TripRead)
def update_trip(trip_id: int, trip_data: trips.TripUpdate, db: Session = Depends(get_db)):
    """Update trip status and fare information."""
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")

        update_data = trip_data.dict(exclude_unset=True)
        for key, value in update_data.items():
            if hasattr(trip, key):
                setattr(trip, key, value)

        db.add(trip)
        db.commit()
        db.refresh(trip)

        logger.info(f"Trip {trip_id} updated successfully")
        return trip

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error updating trip {trip_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error updating trip {trip_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")
