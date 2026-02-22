import asyncio
from app.services.ai_service import generate_plant_details

async def main():
    try:
        res = await generate_plant_details(common_name="Rose")
        print("Success!", res.description)
    except Exception as e:
        print("Error:", e)
        raise e

asyncio.run(main())
