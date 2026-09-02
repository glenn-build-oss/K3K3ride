from sqlalchemy.orm import Session
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)


def find_nearest_rider(db: Session, lat: float, lng: float) -> int | None:
    """
    Find the nearest available rider to the given coordinates.
    
    Args:
        db: Database session
        lat: Latitude (-90 to 90)
        lng: Longitude (-180 to 180)
    
    Returns:
        Rider ID if found, None otherwise
    """
    try:
        # Validate coordinates
        if not (-90 <= lat <= 90):
            logger.error(f"Invalid latitude: {lat}")
            return None
        if not (-180 <= lng <= 180):
            logger.error(f"Invalid longitude: {lng}")
            return None
        
        # Query for nearest available rider
        query = text("""
            SELECT id FROM riders 
            WHERE is_available = true 
            ORDER BY location <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) 
            LIMIT 1
        """)
        
        result = db.execute(query, {"lat": lat, "lng": lng}).fetchone()
        
        if result:
            return result[0]
        
        logger.info(f"No available drivers found for coordinates ({lat}, {lng})")
        return None
        
    except Exception as e:
        logger.error(f"Error finding nearest driver: {e}")
        return None
