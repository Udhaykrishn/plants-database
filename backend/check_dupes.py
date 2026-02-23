
import asyncio
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

async def check_dupes():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text('SELECT common_name, count(*) FROM plants GROUP BY common_name HAVING count(*) > 1'))
        print("Duplicates:", res.all())

if __name__ == "__main__":
    asyncio.run(check_dupes())
