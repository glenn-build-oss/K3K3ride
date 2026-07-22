from fastapi import WebSocket
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, key: int, websocket: WebSocket):
        """Accept and register a new WebSocket connection."""
        try:
            await websocket.accept()
            if key not in self.active_connections:
                self.active_connections[key] = []
            self.active_connections[key].append(websocket)
            logger.info(f"Client connected to key {key}. Active connections: {len(self.active_connections[key])}")
        except Exception as e:
            logger.error(f"Error accepting WebSocket connection for key {key}: {e}")
            raise

    def disconnect(self, key: int, websocket: WebSocket):
        """Remove and unregister a WebSocket connection."""
        try:
            if key in self.active_connections:
                if websocket in self.active_connections[key]:
                    self.active_connections[key].remove(websocket)
                    logger.info(f"Client disconnected from key {key}. Active connections: {len(self.active_connections[key])}")
                    
                    # Clean up empty lists
                    if not self.active_connections[key]:
                        del self.active_connections[key]
            else:
                logger.warning(f"Attempted to disconnect from non-existent key {key}")
        except Exception as e:
            logger.error(f"Error disconnecting WebSocket for key {key}: {e}")

    async def send(self, key: int, message: dict) -> int:
        """
        Send a message to all WebSocket clients connected to a key.
        
        Args:
            key: Connection key (driver_id or trip_id)
            message: Message dictionary to send
        
        Returns:
            Number of successful sends
        """
        if key not in self.active_connections:
            logger.debug(f"No active connections for key {key}")
            return 0
        
        sent_count = 0
        disconnected_clients = []
        
        for ws in self.active_connections[key]:
            try:
                await ws.send_json(message)
                sent_count += 1
            except Exception as e:
                logger.warning(f"Error sending message to client {key}: {e}")
                disconnected_clients.append(ws)
        
        # Clean up disconnected clients
        for ws in disconnected_clients:
            try:
                self.disconnect(key, ws)
            except Exception as e:
                logger.error(f"Error cleaning up disconnected client: {e}")
        
        return sent_count

    def get_connection_count(self, key: int) -> int:
        """Get the number of active connections for a key."""
        return len(self.active_connections.get(key, []))


manager = ConnectionManager()
