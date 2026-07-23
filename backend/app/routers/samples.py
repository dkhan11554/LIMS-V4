"""Port of the core sample-registration workflow in convex/samples.ts.

This is the most representative vertical slice for reviewers: it shows how a
Convex `mutation` with several `ctx.db.insert` calls inside one implicit
transaction (register a sample + create its sampleTests + write a
chain-of-custody entry) maps onto a single SQLAlchemy `Session` transaction
that is committed once at the end."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_reviewer, require_sample_manager
from app.db.session import get_db
from app.models.catalogue import Test
from app.models.customers import Customer
from app.models.organization import User
from app.models.samples import ChainOfCustody, Sample, SampleTest
from app.schemas.samples import SampleCreate, SampleRead, SampleStatusUpdate, SampleTestRead
from app.services.lims_numbering import get_next_lims_number

router = APIRouter(prefix="/samples", tags=["samples"])

# Port of convex/samples.ts `addCustodyEntry` helper.
def _add_custody_entry(db: Session, sample_id: uuid.UUID, user_id: uuid.UUID, action: str, **opts) -> None:
    db.add(
        ChainOfCustody(
            sample_id=sample_id,
            user_id=user_id,
            action=action,
            timestamp=datetime.now(timezone.utc).isoformat(),
            **opts,
        )
    )


@router.get("", response_model=list[SampleRead])
def list_samples(
    laboratory_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Sample).order_by(Sample.created_at.desc())
    if laboratory_id:
        stmt = stmt.where(Sample.laboratory_id == laboratory_id)
    if status_filter:
        stmt = stmt.where(Sample.status == status_filter)
    return db.execute(stmt).scalars().all()


@router.get("/{sample_id}", response_model=SampleRead)
def get_sample(sample_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    sample = db.get(Sample, sample_id)
    if not sample:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sample not found")
    return sample


@router.get("/{sample_id}/tests", response_model=list[SampleTestRead])
def list_sample_tests(sample_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.execute(select(SampleTest).where(SampleTest.sample_id == sample_id)).scalars().all()


@router.get("/mine/assigned", response_model=list[SampleTestRead])
def get_my_assigned_tests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Port of convex/samples.ts::getMyAssignedTests."""
    stmt = select(SampleTest).where(
        SampleTest.assigned_to == current_user.id,
        SampleTest.status.in_(["assigned", "in_progress"]),
    )
    return db.execute(stmt).scalars().all()


@router.post("", response_model=SampleRead, status_code=status.HTTP_201_CREATED)
def register_sample(
    payload: SampleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_sample_manager),
):
    customer = db.get(Customer, payload.customer_id)
    if not customer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")

    lims_number = get_next_lims_number(db, payload.laboratory_id)

    sample = Sample(
        lims_number=lims_number,
        status="registered",
        created_by=user.id,
        **payload.model_dump(exclude={"test_ids"}),
    )
    db.add(sample)
    db.flush()  # obtain sample.id before creating dependent rows

    for test_id in payload.test_ids:
        if not db.get(Test, test_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Test {test_id} not found")
        db.add(SampleTest(sample_id=sample.id, test_id=test_id, status="not_assigned", created_by=user.id))

    _add_custody_entry(db, sample.id, user.id, "registered")

    db.commit()
    db.refresh(sample)
    return sample


# Convex's `status` union (see schema.ts::samples.status) enforced here as a
# simple allow-list rather than a DB CHECK constraint, matching the source.
_VALID_TRANSITIONS: dict[str, set[str]] = {
    "registered": {"awaiting_receipt", "received", "cancelled"},
    "awaiting_receipt": {"received", "cancelled"},
    "received": {"accepted", "rejected"},
    "accepted": {"assigned", "preparation"},
    "assigned": {"testing", "preparation"},
    "preparation": {"testing"},
    "testing": {"result_entered"},
    "result_entered": {"pending_review"},
    "pending_review": {"returned", "pending_qa"},
    "returned": {"testing"},
    "pending_qa": {"oos_investigation", "approved"},
    "oos_investigation": {"approved", "rejected"},
    "approved": {"coa_generated"},
    "coa_generated": {"delivered"},
    "delivered": {"stored"},
    "stored": {"disposed"},
}


@router.post("/{sample_id}/status", response_model=SampleRead)
def transition_sample_status(
    sample_id: uuid.UUID,
    payload: SampleStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_reviewer),
):
    sample = db.get(Sample, sample_id)
    if not sample:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sample not found")

    allowed = _VALID_TRANSITIONS.get(sample.status, set())
    if payload.status not in allowed:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Cannot transition sample from '{sample.status}' to '{payload.status}'",
        )

    sample.status = payload.status
    _add_custody_entry(db, sample.id, user.id, payload.status, notes=payload.reason)
    db.commit()
    db.refresh(sample)
    return sample
