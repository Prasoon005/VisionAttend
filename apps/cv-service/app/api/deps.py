import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status

from app.config import Settings


def get_app_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def require_service_token(
    settings: Annotated[Settings, Depends(get_app_settings)],
    x_service_token: Annotated[str | None, Header()] = None,
) -> None:
    """Guards /internal routes: only the VisionAttend API may call them.

    `compare_digest` runs in constant time, so response timing does not
    reveal how many leading characters of a guessed token were correct.
    """
    expected = settings.cv_service_token.get_secret_value()
    if x_service_token is None or not secrets.compare_digest(x_service_token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing service token",
        )
