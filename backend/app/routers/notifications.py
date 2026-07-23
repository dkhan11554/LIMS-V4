"""Port of convex/notifications.ts, wired to the WebSocket hub so the bell
icon updates immediately instead of via Convex's automatic subscription."""

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.notifications import Notification
from app.models.organization import User
from app.schemas.notifications import NotificationRead
from app.services.realtime import hub

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
def list_my_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(100)
    )
    return db.execute(stmt).scalars().all()


@router.post("/{notification_id}/read", response_model=NotificationRead)
def mark_read(
    notification_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    notification = db.get(Notification, notification_id)
    if not notification or notification.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


async def create_and_push_notification(
    db: Session,
    background_tasks: BackgroundTasks,
    *,
    user_id: uuid.UUID,
    title: str,
    message: str,
    type: str,
    related_module: str | None = None,
    related_id: str | None = None,
) -> Notification:
    """Helper other routers call after a mutation (e.g. sample assigned,
    OOS raised) to persist + push a notification in one step."""
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        related_module=related_module,
        related_id=related_id,
        is_read=False,
    )
    db.add(notification)
    db.flush()

    background_tasks.add_task(
        hub.publish,
        f"notifications:{user_id}",
        {
            "id": str(notification.id),
            "title": title,
            "message": message,
            "type": type,
        },
    )
    return notification
