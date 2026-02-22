import asyncio
from app.services.ai_service import generate_plant_details

async def test():
    try:
        res = await generate_plant_details("Rose")
        print(res)
    except Exception as e:
        print("ERROR:", e)

asyncio.run(test())
