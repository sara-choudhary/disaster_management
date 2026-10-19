from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.department import Department
from app.schemas.department import DepartmentCreate, DepartmentResponse, DepartmentUpdate
from app.services.seed_data import seed_database_idempotent

router = APIRouter()


@router.get("", response_model=List[DepartmentResponse], tags=["Departments"])
def list_departments(db: Session = Depends(get_db)):
    """List all emergency response departments."""
    seed_database_idempotent(db)
    return db.query(Department).all()


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED, tags=["Departments"])
def create_department(payload: DepartmentCreate, db: Session = Depends(get_db)):
    """Create a new department."""
    existing = db.query(Department).filter(Department.code == payload.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department with code '{payload.code}' already exists",
        )
    dept = Department(**payload.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.patch("/{dept_id}", response_model=DepartmentResponse, tags=["Departments"])
def update_department(dept_id: str, payload: DepartmentUpdate, db: Session = Depends(get_db)):
    """Update a department's VLAN ID, subnet, gateway, or metadata."""
    dept = (
        db.query(Department)
        .filter(
            (Department.code == dept_id)
            | (Department.name == dept_id)
            | (Department.id == int(dept_id) if dept_id.isdigit() else False)
        )
        .first()
    )
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department '{dept_id}' not found",
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(dept, field, value)
    db.commit()
    db.refresh(dept)
    return dept

