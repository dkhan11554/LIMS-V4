from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Customer, Sample, user_laboratories
from app.schemas import (
    DashboardPriority,
    DashboardRecentSample,
    DashboardStatistics,
    DashboardVolumeByDay,
)
from app.security import CurrentUserDependency

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
SessionDependency = Annotated[AsyncSession, Depends(get_session)]

IN_PROGRESS_STATUSES = {"testing", "preparation", "assigned"}
PENDING_REVIEW_STATUSES = {"pending_review", "pending_qa"}
COMPLETED_STATUSES = {"approved", "coa_generated", "delivered"}
NON_OVERDUE_STATUSES = COMPLETED_STATUSES | {"cancelled", "disposed"}


def empty_statistics() -> DashboardStatistics:
    return DashboardStatistics(
        total=0,
        in_progress=0,
        pending_review=0,
        completed=0,
        overdue=0,
        status_counts={},
        volume_by_day=[],
        by_priority=DashboardPriority(routine=0, urgent=0, stat=0),
        avg_tat_days=0,
        recent_samples=[],
    )


@router.get("/statistics", response_model=DashboardStatistics)
async def get_dashboard_statistics(
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> DashboardStatistics:
    """Return dashboard metrics scoped to the current user's laboratory access."""
    laboratory_ids = list(
        await session.scalars(
            select(user_laboratories.c.laboratory_id).where(
                user_laboratories.c.user_id == current_user.id
            )
        )
    )
    if not laboratory_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not assigned to a laboratory",
        )

    samples = list(
        await session.scalars(
            select(Sample).where(Sample.laboratory_id.in_(laboratory_ids))
        )
    )
    if not samples:
        return empty_statistics()

    now = datetime.now(UTC)
    total = len(samples)
    status_counts: dict[str, int] = {}
    priority_counts = {"routine": 0, "urgent": 0, "stat": 0}
    in_progress = 0
    pending_review = 0
    completed = 0
    overdue = 0

    for sample in samples:
        status_counts[sample.status] = status_counts.get(sample.status, 0) + 1
        if sample.priority in priority_counts:
            priority_counts[sample.priority] += 1
        if sample.status in IN_PROGRESS_STATUSES:
            in_progress += 1
        if sample.status in PENDING_REVIEW_STATUSES:
            pending_review += 1
        if sample.status in COMPLETED_STATUSES:
            completed += 1
        if (
            sample.requested_completion_date
            and sample.requested_completion_date < now
            and sample.status not in NON_OVERDUE_STATUSES
        ):
            overdue += 1

    thirty_days_ago = now - timedelta(days=30)
    volume_by_day = {
        (thirty_days_ago + timedelta(days=offset)).date().isoformat(): 0
        for offset in range(30)
    }
    for sample in samples:
        if sample.created_at >= thirty_days_ago:
            day = sample.created_at.astimezone(UTC).date().isoformat()
            if day in volume_by_day:
                volume_by_day[day] += 1

    completed_with_received_dates = [
        sample
        for sample in samples
        if sample.status in COMPLETED_STATUSES and sample.received_date is not None
    ]
    avg_tat_days = (
        round(
            sum(
                max(0, (now - sample.received_date).total_seconds() / 86_400)
                for sample in completed_with_received_dates
            )
            / len(completed_with_received_dates),
            1,
        )
        if completed_with_received_dates
        else 0
    )

    recent = sorted(samples, key=lambda sample: sample.created_at, reverse=True)[:10]
    customer_ids = {sample.customer_id for sample in recent}
    customers = {
        customer.id: customer.name
        for customer in await session.scalars(
            select(Customer).where(Customer.id.in_(customer_ids))
        )
    }

    return DashboardStatistics(
        total=total,
        in_progress=in_progress,
        pending_review=pending_review,
        completed=completed,
        overdue=overdue,
        status_counts=status_counts,
        volume_by_day=[
            DashboardVolumeByDay(date=date, count=count)
            for date, count in volume_by_day.items()
        ],
        by_priority=DashboardPriority(**priority_counts),
        avg_tat_days=avg_tat_days,
        recent_samples=[
            DashboardRecentSample(
                id=sample.id,
                lims_number=sample.lims_number,
                sample_name=sample.sample_name,
                customer_name=customers.get(sample.customer_id, "Unknown"),
                priority=sample.priority,
                status=sample.status,
            )
            for sample in recent
        ],
    )
