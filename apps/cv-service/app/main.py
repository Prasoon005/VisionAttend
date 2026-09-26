"""VisionAttend CV service.

Run with the application factory so configuration is validated at startup:
    uvicorn app.main:create_app --factory --port 8000
"""

import logging

from fastapi import FastAPI

from app.api import health, internal
from app.config import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    app = FastAPI(
        title="VisionAttend CV Service",
        version=settings.service_version,
        # Internal service: interactive docs are for local development only.
        docs_url="/docs",
        redoc_url=None,
    )
    app.state.settings = settings
    app.include_router(health.router)
    app.include_router(internal.router)
    return app
