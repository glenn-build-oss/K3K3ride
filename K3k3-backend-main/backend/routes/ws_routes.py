from fastapi import WebSocket, WebSocketDisconnect, APIRouter
from services.ws_manager import manager
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ws", tags=["Notifications"])


@router.websocket("/trips/{trip_id}")
async def trip_updates(websocket: WebSocket, trip_id: int):
    """
    WebSocket endpoint for trip updates. 
    Clients connect to receive real-time trip status changes and driver location updates.
    """
    try:
        key = trip_id
        await manager.connect(key, websocket)
        logger.info(f"Trip {trip_id} WebSocket connected")

        try:
            while True:
                await websocket.receive_text()  # Keep alive
        except WebSocketDisconnect:
            manager.disconnect(key, websocket)
            logger.info(f"Trip {trip_id} WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in trip WebSocket for {trip_id}: {e}")
        try:
            await websocket.close(code=1011, reason="Internal server error")
        except Exception as close_error:
            logger.error(f"Error closing WebSocket: {close_error}")


@router.websocket("/drivers/{driver_id}")
async def driver_channel(websocket: WebSocket, driver_id: int):
    """
    WebSocket endpoint for driver notifications. 
    Drivers receive trip assignments, passenger details, and real-time updates.
    """
    try:
        key = driver_id
        await manager.connect(key, websocket)
        logger.info(f"Driver {driver_id} WebSocket connected")

        try:
            while True:
                await websocket.receive_text()  # Keep alive
        except WebSocketDisconnect:
            manager.disconnect(key, websocket)
            logger.info(f"Driver {driver_id} WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in driver WebSocket for {driver_id}: {e}")
        try:
            await websocket.close(code=1011, reason="Internal server error")
        except Exception as close_error:
            logger.error(f"Error closing WebSocket: {close_error}")
