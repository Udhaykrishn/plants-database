import asyncio
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

async def f():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text("SELECT id, name, created_at, updated_at FROM projects ORDER BY updated_at DESC LIMIT 5"))
        rows = r.fetchall()
        for row in rows:
            print(row.id, row.name, row.created_at, row.updated_at)

if __name__ == "__main__":
    asyncio.run(f())
