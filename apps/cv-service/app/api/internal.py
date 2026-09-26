from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_app_settings, require_service_token
from app.config import Settings
from app.schemas.health import ServiceInfo

# Every route on this router requires the shared service token.
router = APIRouter(
    prefix="/internal/v1",
    tags=["internal"],
    dependencies=[Depends(require_service_token)],
)


@router.get("/info")
def info(settings: Annotated[Settings, Depends(get_app_settings)]) -> ServiceInfo:
    """Used by the API readiness check to verify connectivity and auth."""
    return ServiceInfo(service="cv-service", version=settings.service_version, models=[])
