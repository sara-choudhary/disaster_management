from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.node import NetworkNode
from app.schemas.node import NodeCreate, NodeResponse, NodeUpdate
from app.services.simulation import seed_default_nodes_if_empty

router = APIRouter()


@router.get("", response_model=List[NodeResponse], tags=["Nodes"])
def list_nodes(db: Session = Depends(get_db)):
    """Retrieve all network nodes in the mesh topology."""
    nodes = seed_default_nodes_if_empty(db)
    return nodes


@router.post("", response_model=NodeResponse, status_code=status.HTTP_201_CREATED, tags=["Nodes"])
def create_node(payload: NodeCreate, db: Session = Depends(get_db)):
    """Register a new emergency network node."""
    existing = db.query(NetworkNode).filter(NetworkNode.node_id == payload.node_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Node with ID '{payload.node_id}' already exists",
        )
    node = NetworkNode(**payload.model_dump())
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@router.get("/{node_id}", response_model=NodeResponse, tags=["Nodes"])
def get_node(node_id: str, db: Session = Depends(get_db)):
    """Get single node details by node_id."""
    node = db.query(NetworkNode).filter(NetworkNode.node_id == node_id).first()
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{node_id}' not found",
        )
    return node


@router.patch("/{node_id}", response_model=NodeResponse, tags=["Nodes"])
def update_node(node_id: str, payload: NodeUpdate, db: Session = Depends(get_db)):
    """Update status, battery, or position of an existing node."""
    node = db.query(NetworkNode).filter(NetworkNode.node_id == node_id).first()
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{node_id}' not found",
        )
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(node, field, value)
    db.commit()
    db.refresh(node)
    return node


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Nodes"])
def delete_node(node_id: str, db: Session = Depends(get_db)):
    """Remove a node from the network topology."""
    node = db.query(NetworkNode).filter(NetworkNode.node_id == node_id).first()
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{node_id}' not found",
        )
    db.delete(node)
    db.commit()
    return None
