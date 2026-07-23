import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Company, Department, Laboratory
from app.schemas import (
    Company as CompanySchema,
)
from app.schemas import (
    CompanyCreate,
    CompanyUpdate,
    DepartmentCreate,
    LaboratoryCreate,
)
from app.schemas import (
    Department as DepartmentSchema,
)
from app.schemas import (
    Laboratory as LaboratorySchema,
)
from app.security import RequireManager

router = APIRouter(prefix="/organization", tags=["organization"])
SessionDependency = Annotated[AsyncSession, Depends(get_session)]


@router.get("/companies", response_model=list[CompanySchema])
async def list_companies(_: RequireManager, session: SessionDependency) -> list[Company]:
    return list(await session.scalars(select(Company).order_by(Company.name)))


@router.post("/companies", response_model=CompanySchema, status_code=status.HTTP_201_CREATED)
async def create_company(
    data: CompanyCreate, current_user: RequireManager, session: SessionDependency
) -> Company:
    company = Company(**data.model_dump(), created_by_id=current_user.id)
    session.add(company)
    await session.commit()
    await session.refresh(company)
    return company


@router.patch("/companies/{company_id}", response_model=CompanySchema)
async def update_company(
    company_id: uuid.UUID, data: CompanyUpdate, _: RequireManager, session: SessionDependency
) -> Company:
    company = await session.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(company, field, value)
    await session.commit()
    await session.refresh(company)
    return company


@router.get("/laboratories", response_model=list[LaboratorySchema])
async def list_laboratories(
    _: RequireManager, session: SessionDependency, company_id: uuid.UUID | None = None
) -> list[Laboratory]:
    statement = select(Laboratory).order_by(Laboratory.name)
    if company_id:
        statement = statement.where(Laboratory.company_id == company_id)
    return list(await session.scalars(statement))


@router.post("/laboratories", response_model=LaboratorySchema, status_code=status.HTTP_201_CREATED)
async def create_laboratory(
    data: LaboratoryCreate, current_user: RequireManager, session: SessionDependency
) -> Laboratory:
    if await session.get(Company, data.company_id) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Company not found",
        )
    laboratory = Laboratory(**data.model_dump(), created_by_id=current_user.id)
    session.add(laboratory)
    await session.commit()
    await session.refresh(laboratory)
    return laboratory


@router.get("/departments", response_model=list[DepartmentSchema])
async def list_departments(
    _: RequireManager, session: SessionDependency, laboratory_id: uuid.UUID | None = None
) -> list[Department]:
    statement = select(Department).order_by(Department.name)
    if laboratory_id:
        statement = statement.where(Department.laboratory_id == laboratory_id)
    return list(await session.scalars(statement))


@router.post("/departments", response_model=DepartmentSchema, status_code=status.HTTP_201_CREATED)
async def create_department(
    data: DepartmentCreate, current_user: RequireManager, session: SessionDependency
) -> Department:
    if await session.get(Laboratory, data.laboratory_id) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Laboratory not found"
        )
    department = Department(**data.model_dump(), created_by_id=current_user.id)
    session.add(department)
    await session.commit()
    await session.refresh(department)
    return department
