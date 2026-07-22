from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import connect
from routes import users, admin, drivers, trips, ws_routes, passanger, vehicles, application
import logging_config  # Initialize logging

logger = logging_config.logger

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application startup")
    connect()
    yield
    logger.info("Application shutdown")

app = FastAPI(
    title="K3k3 Transport API",
    lifespan=lifespan,
    version='0.0.1v',
    description="Ride-hailing backend API with real-time updates"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all route routers
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(drivers.router)
app.include_router(trips.router)
app.include_router(passanger.router)
app.include_router(ws_routes.router)
app.include_router(vehicles.router)
app.include_router(application.router)


logger.info("All routes registered successfully")



if __name__ == '__main__':
    import uvicorn
    logger.info("Starting K3k3 Transport API server...")
    uvicorn.run("main:app", host="localhost", port=8810, reload=True)