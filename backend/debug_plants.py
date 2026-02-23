
import asyncio
import uuid
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import AsyncSessionLocal, engine
from app.models.plant import Plant
from app.models.taxon import Taxon

async def test_fetch_plants():
    async with AsyncSessionLocal() as db:
        try:
            print("Fetching plants...")
            query = select(Plant).options(selectinload(Plant.taxon))
            result = await db.execute(query)
            plants = result.scalars().all()
            print(f"Successfully fetched {len(plants)} plants.")
            for p in plants:
                print(f"Plant: {p.common_name}, Taxon: {p.taxon.name if p.taxon else 'None'}, Place: {p.planting_place} ({type(p.planting_place)})")
        except Exception as e:
            print(f"Error occurred: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_fetch_plants())
