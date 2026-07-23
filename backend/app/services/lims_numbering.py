"""Direct port of `getNextLimsNumber` from convex/samples.ts.

Convex relied on its serializable-by-default mutations to make the
read-then-increment race-free; the SQL equivalent uses `SELECT ... FOR UPDATE`
row locking (Postgres/SQL Server both support it) inside the caller's
transaction so two concurrent sample registrations in the same lab/year never
collide."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.system_config import LimsCounter


def get_next_lims_number(db: Session, laboratory_id) -> str:
    year = datetime.now(timezone.utc).year

    counter = db.execute(
        select(LimsCounter)
        .where(LimsCounter.laboratory_id == laboratory_id, LimsCounter.year == year)
        .with_for_update()
    ).scalar_one_or_none()

    if counter:
        counter.last_sequence += 1
        seq = counter.last_sequence
    else:
        counter = LimsCounter(laboratory_id=laboratory_id, year=year, last_sequence=1)
        db.add(counter)
        seq = 1

    db.flush()
    return f"LAB-{year}-{seq:06d}"
