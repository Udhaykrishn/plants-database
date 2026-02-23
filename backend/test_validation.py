
import asyncio
from app.db.session import AsyncSessionLocal
from app.models.plant import Plant
from app.schemas.plant import PlantResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def test_serialization():
    async with AsyncSessionLocal() as db:
        query = select(Plant).options(selectinload(Plant.taxon))
        result = await db.execute(query)
        plants = result.scalars().all()
        for p in plants:
            try:
                # This mimics what FastAPI does
                PlantResponse.model_validate(p)
                print(f"Validated: {p.common_name}")
            except Exception as e:
                print(f"FAILED validation for {p.common_name}: {e}")
                import traceback
                traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_serialization())
