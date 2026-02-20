from typing import Any, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.plant import Plant
from app.models.taxon import Taxon
from app.models.enums import PlantCategory, PlantingPlace, Rank
from app.schemas.plant import PlantCreate, PlantResponse, PlantUpdate

router = APIRouter()

@router.get("/", response_model=List[PlantResponse])
async def read_plants(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    category: Optional[PlantCategory] = None,
    planting_place: Optional[PlantingPlace] = None,
    search: Optional[str] = None
) -> Any:
    """
    Retrieve plants with filtering and search.
    """
    query = select(Plant).options(selectinload(Plant.taxon))
    
    if category:
        query = query.filter(Plant.category == category)
    if planting_place:
        query = query.filter(Plant.planting_place == planting_place)
    if search:
        query = query.filter(Plant.common_name.ilike(f"%{search}%"))
        
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=PlantResponse)
async def create_plant(
    *,
    db: AsyncSession = Depends(get_db),
    plant_in: PlantCreate
) -> Any:
    """
    Create new plant.
    Validates that the linked taxon is of rank 'Species'.
    """
    # 1. Validate Taxon
    result = await db.execute(select(Taxon).filter(Taxon.id == plant_in.taxon_id))
    taxon = result.scalars().first()
    if not taxon:
        raise HTTPException(status_code=404, detail="Taxon not found")
    
    if taxon.rank != Rank.SPECIES:
        raise HTTPException(
            status_code=400, 
            detail=f"Plant can only be linked to a Taxon of rank 'Species'. Current rank: {taxon.rank}"
        )

    # 2. Create Plant
    plant = Plant(**plant_in.model_dump())
    db.add(plant)
    await db.commit()
    await db.refresh(plant)
    
    # Reload with relationships
    result = await db.execute(
        select(Plant).filter(Plant.id == plant.id).options(selectinload(Plant.taxon))
    )
    return result.scalars().first()

@router.get("/{plant_id}", response_model=PlantResponse)
async def read_plant(
    *,
    db: AsyncSession = Depends(get_db),
    plant_id: uuid.UUID
) -> Any:
    """
    Get plant by ID.
    """
    query = select(Plant).filter(Plant.id == plant_id).options(selectinload(Plant.taxon))
    result = await db.execute(query)
    plant = result.scalars().first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant

@router.put("/{plant_id}", response_model=PlantResponse)
async def update_plant(
    *,
    db: AsyncSession = Depends(get_db),
    plant_id: uuid.UUID,
    plant_in: PlantUpdate
) -> Any:
    """
    Update plant by ID.
    """
    result = await db.execute(select(Plant).filter(Plant.id == plant_id))
    plant = result.scalars().first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    if plant_in.taxon_id and plant_in.taxon_id != plant.taxon_id:
        taxon_res = await db.execute(select(Taxon).filter(Taxon.id == plant_in.taxon_id))
        taxon = taxon_res.scalars().first()
        if not taxon or taxon.rank != Rank.SPECIES:
            raise HTTPException(status_code=400, detail="Invalid Taxon or Rank must be Species")

    update_data = plant_in.model_dump(exclude_unset=True)
    for field in update_data:
        setattr(plant, field, update_data[field])

    await db.commit()
    await db.refresh(plant)
    
    # Reload with relationships
    result = await db.execute(
        select(Plant).filter(Plant.id == plant.id).options(selectinload(Plant.taxon))
    )
    return result.scalars().first()

@router.delete("/{plant_id}")
async def delete_plant(
    *,
    db: AsyncSession = Depends(get_db),
    plant_id: uuid.UUID
) -> Any:
    """
    Delete plant.
    """
    result = await db.execute(select(Plant).filter(Plant.id == plant_id))
    plant = result.scalars().first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    await db.delete(plant)
    await db.commit()
    return {"success": True}
