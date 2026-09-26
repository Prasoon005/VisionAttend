from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["cv-service"]
    version: str
    opencv_version: str
    numpy_version: str


class ServiceInfo(BaseModel):
    service: Literal["cv-service"]
    version: str
    # Face models loaded into memory. Empty until the recognition pipeline
    # is added in Phase 5.
    models: list[str]
