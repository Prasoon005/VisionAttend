from typing import Annotated

import cv2
import numpy as np
from fastapi import APIRouter, Depends

from app.api.deps import get_app_settings
from app.config import Settings
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health")
def health(settings: Annotated[Settings, Depends(get_app_settings)]) -> HealthResponse:
    """Liveness probe. Also confirms the native CV libraries import correctly."""
    return HealthResponse(
        status="ok",
        service="cv-service",
        version=settings.service_version,
        opencv_version=str(cv2.__version__),
        numpy_version=np.__version__,
    )
