from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.models.plant import Plant
from app.models.taxon import Taxon
from app.models.category import Category
from app.models.project import Project
from app.schemas.dashboard import DashboardStats

router = APIRouter()

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get total counts for dashboard overview.
    This replaces several large API calls that were only used for counts.
    """
    
    # Independent scalar aggregates share one network round trip. Do not run
    # concurrent execute calls against a single AsyncSession.
    result = await db.execute(select(
        select(func.count()).select_from(Plant).scalar_subquery().label("total_plants"),
        select(func.count()).select_from(Taxon).scalar_subquery().label("total_taxonomy_nodes"),
        select(func.count()).select_from(Category).scalar_subquery().label("total_categories"),
        select(func.count()).select_from(Project).scalar_subquery().label("total_projects"),
    ))
    return dict(result.mappings().one())
