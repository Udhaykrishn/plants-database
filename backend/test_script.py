import asyncio
from app.db.session import SessionLocal
from sqlalchemy import text

async def f():
    async with SessionLocal() as db:
        r = await db.execute(text("SELECT id, name, created_at, updated_at FROM projects ORDER BY updated_at DESC LIMIT 3"))
        rows = r.fetchall()
        for row in rows:
            print(row)

asyncio.run(f())
