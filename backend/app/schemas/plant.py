from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.models.enums import PlantCategory, PlantingPlace
from app.schemas.taxon import TaxonResponse

class PlantBase(BaseModel):
    common_name: str
    category: PlantCategory
    planting_place: PlantingPlace
    description: Optional[str] = None
    care_data: Optional[Dict[str, Any]] = None
    taxon_id: uuid.UUID

class PlantCreate(PlantBase):
    pass

class PlantUpdate(PlantBase):
    common_name: Optional[str] = None
    category: Optional[PlantCategory] = None
    planting_place: Optional[PlantingPlace] = None
    taxon_id: Optional[uuid.UUID] = None

class PlantResponse(PlantBase):
    id: uuid.UUID
    created_at: datetime
    taxon: Optional[TaxonResponse] = None
    
    model_config = ConfigDict(from_attributes=True)
