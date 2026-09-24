from typing import Any, List, Optional
import uuid
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
import sqlalchemy as sa
from sqlalchemy.orm import selectinload
from sqlalchemy.dialects.postgresql import insert
from pydantic import BaseModel

from app.db.session import get_db
from app.models.project import Project, ProjectPlant
from app.models.plant import Plant
from app.models.share_link import ProjectShareLink
from app.schemas.project import (
    ProjectCreate, ProjectResponse, ProjectPlantCreate, ProjectUpdate,
    ProjectListResponse, ProjectSummary, ProjectPlantMutationResponse,
)
from app.core.security import get_current_user

router = APIRouter()

@router.get("/", response_model=ProjectListResponse, dependencies=[Depends(get_current_user)])
async def read_projects(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    sort: Optional[str] = "newest"
) -> Any:
    """
    Retrieve project summaries with plant_count (no nested plants).
    """
    filters = []
    if search:
        filters.append(or_(
            Project.name.ilike(f"%{search}%"),
            Project.client_name.ilike(f"%{search}%"),
            Project.location.ilike(f"%{search}%"),
            Project.description.ilike(f"%{search}%"),
        ))

    count_stmt = select(func.count()).select_from(Project)
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = (await db.execute(count_stmt)).scalar_one()

    plant_count_sq = (
        select(func.count(ProjectPlant.plant_id))
        .where(ProjectPlant.project_id == Project.id)
        .correlate(Project)
        .scalar_subquery()
        .label("plant_count")
    )
    query = select(Project, plant_count_sq)
    if filters:
        query = query.where(*filters)

    if sort == "newest":
        query = query.order_by(Project.updated_at.desc())
    elif sort == "oldest":
        query = query.order_by(Project.updated_at.asc())
    elif sort == "name-asc":
        query = query.order_by(Project.name.asc())
    elif sort == "name-desc":
        query = query.order_by(Project.name.desc())
    else:
        query = query.order_by(Project.updated_at.desc())

    query = query.offset(skip).limit(limit)
    rows = (await db.execute(query)).all()

    items = [
        ProjectSummary(
            id=proj.id,
            name=proj.name,
            client_name=proj.client_name,
            location=proj.location,
            description=proj.description,
            created_at=proj.created_at,
            updated_at=proj.updated_at,
            plant_count=int(count or 0),
        )
        for proj, count in rows
    ]
    return {"items": items, "total": total}

@router.post("/", response_model=ProjectResponse, dependencies=[Depends(get_current_user)])
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


# ─── Public project view by share token (MUST be before /{project_id}) ───────
@router.get("/share/{token}", response_model=ProjectResponse)
async def get_project_by_share_token(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Public endpoint: fetch a project via its share token.
    Returns 404 if not found; 410 Gone if expired.
    """
    result = await db.execute(
        select(ProjectShareLink).filter(ProjectShareLink.token == token)
    )
    link = result.scalars().first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    if link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Share link has expired")

    query = select(Project).filter(Project.id == link.project_id).options(
        selectinload(Project.plants).joinedload(ProjectPlant.plant).joinedload(Plant.taxon)
    )
    result = await db.execute(query)
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}", response_model=ProjectResponse, dependencies=[Depends(get_current_user)])
async def read_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: uuid.UUID
) -> Any:
    """
    Get project by ID.
    """
    query = select(Project).filter(Project.id == project_id).options(
        selectinload(Project.plants).joinedload(ProjectPlant.plant).joinedload(Plant.taxon)
    )
    result = await db.execute(query)
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/{project_id}/plants", response_model=ProjectPlantMutationResponse, dependencies=[Depends(get_current_user)])
async def add_plant_to_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: uuid.UUID,
    plant_in: ProjectPlantCreate
) -> Any:
    """
    Add plant to project. Returns slim association only (RIA-18).
    """
    # Validate IDs in one round trip without loading either full record.
    project_exists, plant_exists = (await db.execute(select(
        sa.exists().where(Project.id == project_id),
        sa.exists().where(Plant.id == plant_in.plant_id),
    ))).one()
    if not project_exists:
        raise HTTPException(status_code=404, detail="Project not found")
    if not plant_exists:
        raise HTTPException(status_code=404, detail="Plant not found")

    # The existing composite primary key makes concurrent adds atomic. RETURNING
    # avoids a post-commit refresh (and a second connection checkout/transaction).
    values = plant_in.model_dump()
    statement = insert(ProjectPlant).values(project_id=project_id, **values)
    statement = statement.on_conflict_do_update(
        index_elements=[ProjectPlant.project_id, ProjectPlant.plant_id],
        set_={key: getattr(statement.excluded, key) for key in values if key != "plant_id"},
    )
    touch_project = (
        sa.update(Project).where(Project.id == project_id)
        .values(updated_at=datetime.utcnow()).returning(Project.id)
        .cte("touch_project")
    )
    result = await db.execute(
        statement.add_cte(touch_project).returning(*ProjectPlant.__table__.columns)
    )
    association = dict(result.mappings().one())
    await db.commit()
    return association

@router.put("/{project_id}/plants/{plant_id}", response_model=ProjectPlantMutationResponse, dependencies=[Depends(get_current_user)])
async def update_plant_in_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: uuid.UUID,
    plant_id: uuid.UUID,
    plant_in: ProjectPlantCreate
) -> Any:
    """
    Update a plant association in a project. Returns slim association (RIA-18).
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

    existing.notes = plant_in.notes
    existing.quantity = plant_in.quantity
    existing.unit = plant_in.unit
    existing.optimum_height_size = plant_in.optimum_height_size
    existing.rate = plant_in.rate

    project.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(existing)
    return existing

@router.delete("/{project_id}/plants/{plant_id}", response_model=ProjectPlantMutationResponse, dependencies=[Depends(get_current_user)])
async def remove_plant_from_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: uuid.UUID,
    plant_id: uuid.UUID
) -> Any:
    """
    Remove a plant from a project. Returns the deleted slim association (RIA-18).
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

    slim = ProjectPlantMutationResponse(
        project_id=existing.project_id,
        plant_id=existing.plant_id,
        notes=existing.notes,
        quantity=existing.quantity,
        unit=existing.unit,
        optimum_height_size=existing.optimum_height_size,
        rate=existing.rate,
    )
    await db.delete(existing)
    project.updated_at = datetime.utcnow()
    await db.commit()
    return slim

@router.put("/{project_id}", response_model=ProjectResponse, dependencies=[Depends(get_current_user)])
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

    project.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(project)
    
    # Reload with relationships
    query = select(Project).filter(Project.id == project.id).options(
        selectinload(Project.plants).selectinload(ProjectPlant.plant).selectinload(Plant.taxon)
    )
    result = await db.execute(query)
    return result.scalars().first()

@router.delete("/{project_id}", dependencies=[Depends(get_current_user)])
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

@router.post("/{project_id}/duplicate", response_model=ProjectResponse, dependencies=[Depends(get_current_user)])
async def duplicate_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: uuid.UUID
) -> Any:
    """
    Duplicate a project including its plants.
    """
    # Fetch source project
    query = select(Project).filter(Project.id == project_id).options(
        selectinload(Project.plants)
    )
    result = await db.execute(query)
    source_project = result.scalars().first()
    
    if not source_project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create new project
    new_project = Project(
        name=f"{source_project.name} (Copy)",
        client_name=source_project.client_name,
        location=source_project.location,
        description=source_project.description
    )
    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)

    # Copy plants
    for pp in source_project.plants:
        new_pp = ProjectPlant(
            project_id=new_project.id,
            plant_id=pp.plant_id,
            notes=pp.notes,
            quantity=pp.quantity,
            unit=pp.unit,
            optimum_height_size=pp.optimum_height_size,
            rate=pp.rate
        )
        db.add(new_pp)
    
    await db.commit()

    # Reload with relationships
    query = select(Project).filter(Project.id == new_project.id).options(
        selectinload(Project.plants).selectinload(ProjectPlant.plant).selectinload(Plant.taxon)
    )
    result = await db.execute(query)
    return result.scalars().first()


# ─── Share link schemas ────────────────────────────────────────────────────────
class ShareLinkResponse(BaseModel):
    token: str
    expires_at: datetime
    url: str


# ─── Generate / regenerate share link ─────────────────────────────────────────
@router.post("/{project_id}/share", response_model=ShareLinkResponse, dependencies=[Depends(get_current_user)])
async def create_or_regenerate_share_link(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: uuid.UUID,
) -> Any:
    """
    Generate (or regenerate) a 2-day share link for the project.
    Only one link exists per project; regeneration replaces the old one.
    """
    result = await db.execute(select(Project).filter(Project.id == project_id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=2)

    # Upsert: delete any existing link, create fresh
    existing = await db.execute(
        select(ProjectShareLink).filter(ProjectShareLink.project_id == project_id)
    )
    old = existing.scalars().first()
    if old:
        await db.delete(old)
        await db.flush()

    share_link = ProjectShareLink(
        project_id=project_id,
        token=token,
        expires_at=expires_at,
    )
    db.add(share_link)
    await db.commit()

    return ShareLinkResponse(
        token=token,
        expires_at=expires_at,
        url=f"/share/{token}",
    )


# ─── Get current share link info ──────────────────────────────────────────────
@router.get("/{project_id}/share", response_model=Optional[ShareLinkResponse], dependencies=[Depends(get_current_user)])
async def get_share_link(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: uuid.UUID,
) -> Any:
    """Return the current share link for a project, or null if none exists / expired."""
    result = await db.execute(
        select(ProjectShareLink).filter(ProjectShareLink.project_id == project_id)
    )
    link = result.scalars().first()
    if not link or link.expires_at < datetime.utcnow():
        return None
    return ShareLinkResponse(
        token=link.token,
        expires_at=link.expires_at,
        url=f"/share/{link.token}",
    )
