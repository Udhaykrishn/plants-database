import asyncio
from app.db.session import AsyncSessionLocal
from app.models.category import Category
from app.models.plant import Plant
from sqlalchemy import select, func

async def test():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Category.name, func.count(Plant.id)).outerjoin(Plant, Category.name == Plant.category).group_by(Category.id))
        print("MAPPED STRING:", result.all())
        
        result2 = await db.execute(select(Plant.category, func.count(Plant.id)).group_by(Plant.category))
        print("PLANTS:", result2.all())

asyncio.run(test())
