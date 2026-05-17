from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.deps import lifespan
from app.logging import configure_logging
from app.routers import geocode, overlay, trip


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    app = FastAPI(
        title="Route Planner API",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.include_router(geocode.router)
    app.include_router(trip.router)
    app.include_router(overlay.router)

    @app.get("/api/v1/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
