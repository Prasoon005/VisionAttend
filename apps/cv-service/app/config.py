"""Service configuration, validated at startup.

Values come from environment variables. For local development the repository
root `.env` is read as well; in containers the variables are injected and the
file does not exist.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# In the repository this file is apps/cv-service/app/config.py, so the root
# .env is three levels up. In the container the tree is shallower and no
# .env exists (variables are injected), so no file is used.
_PARENTS = Path(__file__).resolve().parents
_ROOT_ENV_FILE = _PARENTS[3] / ".env" if len(_PARENTS) > 3 else None

PLACEHOLDER_MARKER = "replace_with"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ROOT_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",  # the shared .env also holds API/web variables
    )

    # Shared secret the API must present on /internal/* routes.
    cv_service_token: SecretStr = Field(min_length=32)
    log_level: Literal["critical", "error", "warning", "info", "debug"] = "info"
    service_version: str = "0.1.0"

    @field_validator("log_level", mode="before")
    @classmethod
    def _lowercase_level(cls, value: object) -> object:
        return value.lower() if isinstance(value, str) else value

    @field_validator("cv_service_token")
    @classmethod
    def _reject_placeholder(cls, value: SecretStr) -> SecretStr:
        if PLACEHOLDER_MARKER in value.get_secret_value():
            raise ValueError("CV_SERVICE_TOKEN still contains a placeholder value")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
