"""Port of convex/organization.ts."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_admin, require_manager
from app.db.session import get_db
from app.models.organization import Company, Department, Laboratory, User
from app.schemas.organization import (
    CompanyCreate,
    CompanyRead,
    DepartmentCreate,
    DepartmentRead,
    LaboratoryCreate,
    LaboratoryRead,
)

router = APIRouter(tags=["organization"])


@router.get("/companies", response_model=list[CompanyRead])
def list_companies(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.execute(select(Company).order_by(Company.name)).scalars().all()


@router.post("/companies", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    company = Company(**payload.model_dump(), created_by=user.id)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("/laboratories", response_model=list[LaboratoryRead])
def list_laboratories(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.execute(select(Laboratory).order_by(Laboratory.name)).scalars().all()


@router.post("/laboratories", response_model=LaboratoryRead, status_code=status.HTTP_201_CREATED)
def create_laboratory(
    payload: LaboratoryCreate, db: Session = Depends(get_db), user: User = Depends(require_admin)
):
    if not db.get(Company, payload.company_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Company not found")
    lab = Laboratory(**payload.model_dump(), created_by=user.id)
    db.add(lab)
    db.commit()
    db.refresh(lab)
    return lab


@router.get("/departments", response_model=list[DepartmentRead])
def list_departments(
    laboratory_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Department).order_by(Department.name)
    if laboratory_id:
        stmt = stmt.where(Department.laboratory_id == laboratory_id)
    return db.execute(stmt).scalars().all()


@router.post("/departments", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate, db: Session = Depends(get_db), user: User = Depends(require_manager)
):
    if not db.get(Laboratory, payload.laboratory_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Laboratory not found")
    dept = Department(**payload.model_dump(), created_by=user.id)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept
