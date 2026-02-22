from fastapi import APIRouter
from app.schemas.ai import PlantAIDetailsRequest, PlantAIDetailsResponse
from app.services.ai_service import generate_plant_details

router = APIRouter()

@router.post("/generate-plant-details", response_model=PlantAIDetailsResponse)
async def fetch_plant_details(request: PlantAIDetailsRequest):
    return await generate_plant_details(request.common_name)
