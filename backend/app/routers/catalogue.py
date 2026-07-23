"""Port of convex/catalogue.ts."""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_manager
from app.db.session import get_db
from app.models.catalogue import Test, TestMethod
from app.models.organization import User
from app.schemas.catalogue import TestCreate, TestMethodCreate, TestMethodRead, TestRead

router = APIRouter(tags=["catalogue"])


@router.get("/test-methods", response_model=list[TestMethodRead])
def list_test_methods(
    laboratory_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(TestMethod).where(TestMethod.is_active.is_(True))
    if laboratory_id:
        stmt = stmt.where(TestMethod.laboratory_id == laboratory_id)
    return db.execute(stmt).scalars().all()


@router.post("/test-methods", response_model=TestMethodRead, status_code=status.HTTP_201_CREATED)
def create_test_method(
    payload: TestMethodCreate, db: Session = Depends(get_db), user: User = Depends(require_manager)
):
    method = TestMethod(**payload.model_dump(), created_by=user.id)
    db.add(method)
    db.commit()
    db.refresh(method)
    return method


@router.get("/tests", response_model=list[TestRead])
def list_tests(
    laboratory_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Test).where(Test.is_active.is_(True))
    if laboratory_id:
        stmt = stmt.where(Test.laboratory_id == laboratory_id)
    return db.execute(stmt).scalars().all()


@router.post("/tests", response_model=TestRead, status_code=status.HTTP_201_CREATED)
def create_test(payload: TestCreate, db: Session = Depends(get_db), user: User = Depends(require_manager)):
    test = Test(**payload.model_dump(), created_by=user.id)
    db.add(test)
    db.commit()
    db.refresh(test)
    return test
