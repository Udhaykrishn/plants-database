from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class PlantAIDetailsRequest(BaseModel):
    common_name: Optional[str] = None
    scientific_name: Optional[str] = None

class TaxonomyDetails(BaseModel):
    kingdom: Optional[str] = None
    division: Optional[str] = None
    class_name: Optional[str] = None  # Using class_name since class is reserved
    order: Optional[str] = None
    family: Optional[str] = None
    genus: Optional[str] = None
    species: Optional[str] = None

class PlantAIDetailsResponse(BaseModel):
    common_name: Optional[str] = None
    category: Optional[str] = None
    planting_place: Optional[str] = None  # Indoor, Outdoor, or "Indoor & Outdoor"
    description: Optional[str] = None
    common_diseases: Optional[str] = None
    care_data: Optional[Dict[str, Any]] = None
    taxonomy: Optional[TaxonomyDetails] = None
    icon_url: Optional[str] = None
    image_url: Optional[str] = None
