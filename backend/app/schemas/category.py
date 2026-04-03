from typing import Optional, List
import uuid
from pydantic import BaseModel, ConfigDict

class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(CategoryBase):
    name: Optional[str] = None
    description: Optional[str] = None

class CategoryResponse(CategoryBase):
    id: uuid.UUID
    plant_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class CategoryListResponse(BaseModel):
    items: List[CategoryResponse]
    total: int
