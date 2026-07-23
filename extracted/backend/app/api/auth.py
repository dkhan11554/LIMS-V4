from fastapi import APIRouter

from app.schemas import AuthenticatedUser, CurrentUser
from app.security import CurrentUserDependency

router = APIRouter(prefix="/auth", tags=["authentication"])


def authenticated_user_response(current_user: CurrentUserDependency) -> AuthenticatedUser:
    return AuthenticatedUser(
        id=current_user.id,
        email=current_user.email,
        display_name=current_user.name,
        roles=[current_user.role],
        permissions=[],
    )


@router.get("/me", response_model=CurrentUser)
async def get_me(current_user: CurrentUserDependency) -> CurrentUser:
    """Validate the Entra token and return the LIMS user profile."""
    return CurrentUser.model_validate(current_user)


@router.post("/sync", response_model=AuthenticatedUser)
async def sync_authenticated_user(
    current_user: CurrentUserDependency,
) -> AuthenticatedUser:
    """Validate an Entra token and create or update the local LIMS user."""
    return authenticated_user_response(current_user)
