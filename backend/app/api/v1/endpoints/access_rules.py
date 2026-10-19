from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.access_rule import AccessRule
from app.schemas.access_rule import (
    AccessRuleCreate,
    AccessRuleResponse,
    AccessRuleUpdate,
    ACLEvaluationRequest,
    ACLEvaluationResponse,
)
from app.services.seed_data import seed_database_idempotent
from app.services.acl_service import evaluate_connection

router = APIRouter()


@router.get("", response_model=List[AccessRuleResponse], tags=["Access Rules"])
def list_access_rules(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Retrieve network access rules and firewall policies with pagination."""
    seed_database_idempotent(db)
    return db.query(AccessRule).offset(skip).limit(limit).all()


@router.post("", response_model=AccessRuleResponse, status_code=status.HTTP_201_CREATED, tags=["Access Rules"])
def create_access_rule(payload: AccessRuleCreate, db: Session = Depends(get_db)):
    """Add a new access control rule."""
    existing = db.query(AccessRule).filter(AccessRule.rule_id == payload.rule_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rule '{payload.rule_id}' already exists",
        )
    rule = AccessRule(**payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.post("/evaluate", response_model=ACLEvaluationResponse, tags=["Access Rules"])
def evaluate_access(payload: ACLEvaluationRequest, db: Session = Depends(get_db)):
    """
    Evaluate network access between source and destination endpoints against configured ACL rules.
    Also verifies underlying Layer 3 topological reachability via OSPF SPF simulation.
    """
    return evaluate_connection(db, payload)


@router.patch("/{rule_id}", response_model=AccessRuleResponse, tags=["Access Rules"])
def update_access_rule(rule_id: str, payload: AccessRuleUpdate, db: Session = Depends(get_db)):
    """Enable, disable, or modify an access control rule by rule_id or database id."""
    rule = (
        db.query(AccessRule)
        .filter(
            (AccessRule.rule_id == rule_id)
            | (AccessRule.id == int(rule_id) if rule_id.isdigit() else False)
        )
        .first()
    )
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Access rule '{rule_id}' not found",
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=status.HTTP_200_OK, tags=["Access Rules"])
def delete_access_rule(rule_id: str, db: Session = Depends(get_db)):
    """Delete an access control rule by rule_id or database id."""
    rule = (
        db.query(AccessRule)
        .filter(
            (AccessRule.rule_id == rule_id)
            | (AccessRule.id == int(rule_id) if rule_id.isdigit() else False)
        )
        .first()
    )
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Access rule '{rule_id}' not found",
        )
    db.delete(rule)
    db.commit()
    return {"message": f"Rule '{rule_id}' deleted successfully", "deleted": True}
