from typing import Any, List
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import sqlalchemy as sa
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.project import Project, ProjectPlant
from app.models.plant import Plant
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectPlantCreate, ProjectUpdate

router = APIRouter()

@router.get("/", response_model=List[ProjectResponse])
async def read_projects(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Retrieve projects.
    """
    query = select(Project).options(
        selectinload(Project.plants).selectinload(ProjectPlant.plant).selectinload(Plant.taxon)
    ).order_by(Project.updated_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=ProjectResponse)
async def create_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_in: ProjectCreate
) -> Any:
    """
    Create new project.
    """
    project = Project(**project_in.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    
    # Reload with relationships
    query = select(Project).filter(Project.id == project.id).options(
        selectinload(Project.plants).selectinload(ProjectPlant.plant).selectinload(Plant.taxon)
    )
    result = await db.execute(query)
    return result.scalars().first()

@router.get("/{project_id}", response_model=ProjectResponse)
async def read_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: uuid.UUID
) -> Any:
    """
    Get project by ID.
    """
    query = select(Project).filter(Project.id == project_id).options(
        selectinload(Project.plants).selectinload(ProjectPlant.plant).selectinload(Plant.taxon)
    )
    result = await db.execute(query)
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/{project_id}/plants", response_model=ProjectResponse)
async def add_plant_to_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: uuid.UUID,
    plant_in: ProjectPlantCreate
) -> Any:
    """
    Add plant to project.
    """
    # Check if project exists
    result = await db.execute(select(Project).filter(Project.id == project_id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if plant exists
    result = await db.execute(select(Plant).filter(Plant.id == plant_in.plant_id))
    plant = result.scalars().first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    # Check if already exists in project
    result = await db.execute(
        select(ProjectPlant).filter(
            ProjectPlant.project_id == project_id,
            ProjectPlant.plant_id == plant_in.plant_id
        )
    )
    existing = result.scalars().first()
    
    if existing:
        # Update quantity
        existing.quantity += plant_in.quantity
        if plant_in.notes:
            existing.notes = plant_in.notes
        db.add(existing)
    else:
        # Create new association
        new_association = ProjectPlant(
            project_id=project_id,
            plant_id=plant_in.plant_id,
            quantity=plant_in.quantity,
            notes=plant_in.notes
        )
        db.add(new_association)
        
    project.updated_at = sa.func.now()

    await db.commit()
    await db.refresh(project)
    
    # Reload project with relationships
    query = select(Project).filter(Project.id == project_id).options(
        selectinload(Project.plants).selectinload(ProjectPlant.plant).selectinload(Plant.taxon)
    )
    result = await db.execute(query)
    return result.scalars().first()

@router.put("/{project_id}/plants/{plant_id}", response_model=ProjectResponse)
async def update_plant_in_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: uuid.UUID,
    plant_id: uuid.UUID,
    plant_in: ProjectPlantCreate
) -> Any:
    """
    Update a plant's quantity or notes in a project.
    """
    result = await db.execute(select(Project).filter(Project.id == project_id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(ProjectPlant).filter(
            ProjectPlant.project_id == project_id,
            ProjectPlant.plant_id == plant_id
        )
    )
    existing = result.scalars().first()
    if not existing:
        raise HTTPException(status_code=404, detail="Plant not found in this project")

    existing.quantity = plant_in.quantity
    if plant_in.notes is not None:
        existing.notes = plant_in.notes

    project.updated_at = sa.func.now()
    await db.commit()
    await db.refresh(project)

    query = select(Project).filter(Project.id == project_id).options(
        selectinload(Project.plants).selectinload(ProjectPlant.plant).selectinload(Plant.taxon)
    )
    result = await db.execute(query)
    return result.scalars().first()

@router.delete("/{project_id}/plants/{plant_id}", response_model=ProjectResponse)
async def remove_plant_from_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: uuid.UUID,
    plant_id: uuid.UUID
) -> Any:
    """
    Remove a plant from a project.
    """
    result = await db.execute(select(Project).filter(Project.id == project_id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(ProjectPlant).filter(
            ProjectPlant.project_id == project_id,
            ProjectPlant.plant_id == plant_id
        )
    )
    existing = result.scalars().first()
    if not existing:
        raise HTTPException(status_code=404, detail="Plant not found in this project")

    await db.delete(existing)
    project.updated_at = sa.func.now()
    await db.commit()
    await db.refresh(project)

    query = select(Project).filter(Project.id == project_id).options(
        selectinload(Project.plants).selectinload(ProjectPlant.plant).selectinload(Plant.taxon)
    )
    result = await db.execute(query)
    return result.scalars().first()

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: uuid.UUID,
    project_in: ProjectUpdate
) -> Any:
    """
    Update a project by ID.
    """
    result = await db.execute(select(Project).filter(Project.id == project_id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = project_in.model_dump(exclude_unset=True)
    for field in update_data:
        setattr(project, field, update_data[field])

    project.updated_at = sa.func.now()

    await db.commit()
    await db.refresh(project)
    
    # Reload with relationships
    query = select(Project).filter(Project.id == project.id).options(
        selectinload(Project.plants).selectinload(ProjectPlant.plant).selectinload(Plant.taxon)
    )
    result = await db.execute(query)
    return result.scalars().first()

@router.delete("/{project_id}")
async def delete_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: uuid.UUID
) -> Any:
    """
    Delete a project by ID.
    """
    result = await db.execute(select(Project).filter(Project.id == project_id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.delete(project)
    await db.commit()
    return {"success": True}
