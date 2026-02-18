from typing import Any, List
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.taxon import Taxon
from app.schemas.taxon import TaxonResponse, TaxonCreate, TaxonUpdate, TaxonTree

router = APIRouter()

@router.get("/tree", response_model=List[TaxonTree])
async def get_taxonomy_tree(
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get the full taxonomy tree. Assumes strict hierarchy starting from Kingdom.
    This implementation fetches all taxons and builds the tree in memory for simplicity.
    For very large datasets (100k+), this should be optimized with recursive CTEs or Materialized Path.
    """
    result = await db.execute(select(Taxon))
    taxons = result.scalars().all()
    
    # Build tree
    # 1. Create a map of id -> taxon
    taxon_map = {t.id:  TaxonTree.model_validate(t) for t in taxons}
    
    # 2. Assign children
    roots = []
    for t in taxons:
        if t.parent_id:
            parent = taxon_map.get(t.parent_id)
            if parent:
                parent.children.append(taxon_map[t.id])
        else:
            roots.append(taxon_map[t.id])
            
    return roots

@router.post("/", response_model=TaxonResponse)
async def create_taxon(
    *,
    db: AsyncSession = Depends(get_db),
    taxon_in: TaxonCreate
) -> Any:
    """
    Create new taxon.
    """
    # Validation: Check if parent exists if provided
    if taxon_in.parent_id:
        result = await db.execute(select(Taxon).filter(Taxon.id == taxon_in.parent_id))
        parent = result.scalars().first()
        if not parent:
            raise HTTPException(
                status_code=404,
                detail="Parent taxon not found",
            )
            
    taxon = Taxon(**taxon_in.model_dump())
    db.add(taxon)
    await db.commit()
    await db.refresh(taxon)
    return taxon

@router.get("/{taxon_id}", response_model=TaxonResponse)
async def read_taxon(
    *,
    db: AsyncSession = Depends(get_db),
    taxon_id: uuid.UUID
) -> Any:
    """
    Get taxon by ID.
    """
    result = await db.execute(select(Taxon).filter(Taxon.id == taxon_id))
    taxon = result.scalars().first()
    if not taxon:
        raise HTTPException(
            status_code=404,
            detail="Taxon not found",
        )
    return taxon
