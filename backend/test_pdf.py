import asyncio
from app.db.session import AsyncSessionLocal
from app.models.project import Project, ProjectPlant
from app.models.plant import Plant
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def f():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Project)
            .options(selectinload(Project.plants).selectinload(ProjectPlant.plant).selectinload(Plant.taxon))
            .limit(1)
        )
        project = result.scalars().first()
        if project:
            print(project.name)
            for pp in project.plants:
                print(pp.plant.common_name, pp.plant.taxon.name if pp.plant.taxon else "None")

if __name__ == "__main__":
    asyncio.run(f())
