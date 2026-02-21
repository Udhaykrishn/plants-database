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
    # 1. Create a map of id -> TaxonTree (with empty children initially)
    # We use TaxonResponse to validate from ORM (ignoring children relationship),
    # then dump to dict and create TaxonTree.
    taxon_map = {}
    for t in taxons:
        # Validate as response (no children field) to avoid lazy load trigger
        base_data = TaxonResponse.model_validate(t).model_dump()
        taxon_map[t.id] = TaxonTree(**base_data, children=[])
    
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

@router.put("/{taxon_id}", response_model=TaxonResponse)
async def update_taxon(
    *,
    db: AsyncSession = Depends(get_db),
    taxon_id: uuid.UUID,
    taxon_in: TaxonUpdate
) -> Any:
    """
    Update taxon.
    """
    result = await db.execute(select(Taxon).filter(Taxon.id == taxon_id))
    taxon = result.scalars().first()
    if not taxon:
        raise HTTPException(
            status_code=404,
            detail="Taxon not found",
        )
    
    # Check parent loop or existence if parent_id is updated
    if taxon_in.parent_id is not None and taxon_in.parent_id != taxon.parent_id:
        if taxon_in.parent_id == taxon.id:
            raise HTTPException(status_code=400, detail="Cannot set taxon as its own parent")
        result = await db.execute(select(Taxon).filter(Taxon.id == taxon_in.parent_id))
        parent = result.scalars().first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent taxon not found")
            
    update_data = taxon_in.model_dump(exclude_unset=True)
    for field in update_data:
        setattr(taxon, field, update_data[field])
        
    db.add(taxon)
    await db.commit()
    await db.refresh(taxon)
    return taxon

@router.delete("/{taxon_id}")
async def delete_taxon(
    *,
    db: AsyncSession = Depends(get_db),
    taxon_id: uuid.UUID
) -> Any:
    """
    Delete taxon. Will cascade delete children if explicitly modeled or fail if children exist.
    Currently, we'll try to delete or rely on DB constrainsts.
    """
    result = await db.execute(select(Taxon).filter(Taxon.id == taxon_id))
    taxon = result.scalars().first()
    if not taxon:
        raise HTTPException(
            status_code=404,
            detail="Taxon not found",
        )
    
    # Check if children exist before delete to provide better error optionally
    children_result = await db.execute(select(Taxon).filter(Taxon.parent_id == taxon_id).limit(1))
    if children_result.scalars().first():
         raise HTTPException(
            status_code=400,
            detail="Cannot delete taxon with existing children. Delete children first.",
         )

    await db.delete(taxon)
    await db.commit()
    return {"success": True}
