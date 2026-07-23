from fastapi import APIRouter

from app.schemas import CurrentUser
from app.security import CurrentUserDependency

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.get("/me", response_model=CurrentUser)
async def get_me(current_user: CurrentUserDependency) -> CurrentUser:
    """Validate the Entra token and return the LIMS user profile."""
    return CurrentUser.model_validate(current_user)
