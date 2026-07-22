import redis
import json
import logging

logger = logging.getLogger(__name__)

try:
    r = redis.Redis(host='localhost', port=6379, decode_responses=True)
    r.ping()  # Test connection
except redis.ConnectionError as e:
    logger.warning(f"Redis connection failed: {e}. Location tracking will be unavailable.")
    r = None


def update_driver_location(driver_id: int, lat: float, lng: float) -> bool:
    """Update driver location in Redis cache. Returns True on success, False otherwise."""
    try:
        if not r:
            logger.warning("Redis not available, skipping location update")
            return False
        
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            logger.error(f"Invalid coordinates: lat={lat}, lng={lng}")
            return False
        
        r.set(f"driver:{driver_id}", json.dumps({"lat": lat, "lng": lng}), ex=3600)  # 1 hour expiry
        return True
    except redis.RedisError as e:
        logger.error(f"Redis error updating driver {driver_id} location: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error updating driver location: {e}")
        return False


def get_driver_location(driver_id: int) -> dict | None:
    """Retrieve driver location from Redis cache."""
    try:
        if not r:
            logger.warning("Redis not available, cannot retrieve location")
            return None
        
        data = r.get(f"driver:{driver_id}")
        if data is None:
            return None
        
        return json.loads(data)
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error for driver {driver_id}: {e}")
        return None
    except redis.RedisError as e:
        logger.error(f"Redis error retrieving driver {driver_id} location: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error retrieving driver location: {e}")
        return None

    
