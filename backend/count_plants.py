
import asyncio
from app.db.session import AsyncSessionLocal
from app.models.plant import Plant
from sqlalchemy import select, func

async def count():
    async with AsyncSessionLocal() as db:
        c = await db.scalar(select(func.count(Plant.id)))
        print(f"Total plants: {c}")

if __name__ == "__main__":
    asyncio.run(count())
