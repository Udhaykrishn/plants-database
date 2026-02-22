from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class PlantAIDetailsRequest(BaseModel):
    common_name: str

class TaxonomyDetails(BaseModel):
    kingdom: Optional[str] = None
    division: Optional[str] = None
    class_name: Optional[str] = None  # Using class_name since class is reserved
    order: Optional[str] = None
    family: Optional[str] = None
    genus: Optional[str] = None
    species: Optional[str] = None

class PlantAIDetailsResponse(BaseModel):
    category: Optional[str] = None
    planting_place: Optional[str] = None  # Indoor, Outdoor, or "Indoor & Outdoor"
    description: Optional[str] = None
    care_data: Optional[Dict[str, Any]] = None
    taxonomy: Optional[TaxonomyDetails] = None
