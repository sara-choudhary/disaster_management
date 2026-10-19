from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.link import NetworkLink
from app.schemas.link import NetworkLinkCreate, NetworkLinkResponse, NetworkLinkUpdate
from app.services.seed_data import seed_database_idempotent

router = APIRouter()


@router.get("", response_model=List[NetworkLinkResponse], tags=["Links"])
def list_links(db: Session = Depends(get_db)):
    """Retrieve all peer communication links."""
    seed_database_idempotent(db)
    return db.query(NetworkLink).all()


@router.post("", response_model=NetworkLinkResponse, status_code=status.HTTP_201_CREATED, tags=["Links"])
def create_link(payload: NetworkLinkCreate, db: Session = Depends(get_db)):
    """Register a new peer link between two network nodes."""
    existing = db.query(NetworkLink).filter(NetworkLink.link_id == payload.link_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Link with ID '{payload.link_id}' already exists",
        )
    link = NetworkLink(**payload.model_dump())
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.patch("/{link_id}", response_model=NetworkLinkResponse, tags=["Links"])
def update_link(link_id: str, payload: NetworkLinkUpdate, db: Session = Depends(get_db)):
    """Update link state, bandwidth, or latency."""
    link = db.query(NetworkLink).filter(NetworkLink.link_id == link_id).first()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Link '{link_id}' not found",
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(link, field, value)
    db.commit()
    db.refresh(link)
    return link
