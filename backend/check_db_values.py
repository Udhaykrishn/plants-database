
import asyncio
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text('SELECT DISTINCT planting_place FROM plants'))
        print("Planting places in DB:", res.all())
        
        res = await db.execute(text('SELECT DISTINCT category FROM plants'))
        print("Categories in DB:", res.all())

if __name__ == "__main__":
    asyncio.run(check())
