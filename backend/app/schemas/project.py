from typing import List, Optional
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.plant import PlantResponse

# ProjectPlant Schemas
class ProjectPlantBase(BaseModel):
    plant_id: uuid.UUID
    quantity: int = 1
    notes: Optional[str] = None

class ProjectPlantCreate(ProjectPlantBase):
    pass

class ProjectPlantUpdate(BaseModel):
    quantity: Optional[int] = None
    notes: Optional[str] = None

class ProjectPlantResponse(ProjectPlantBase):
    plant: Optional[PlantResponse] = None # Nested plant details
    model_config = ConfigDict(from_attributes=True)

# Project Schemas
class ProjectBase(BaseModel):
    name: str
    client_name: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(ProjectBase):
    pass

class ProjectResponse(ProjectBase):
    id: uuid.UUID
    created_at: datetime
    plants: List[ProjectPlantResponse] = []
    
    model_config = ConfigDict(from_attributes=True)
