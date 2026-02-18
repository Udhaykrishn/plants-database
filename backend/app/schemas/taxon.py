from typing import List, Optional, ForwardRef
import uuid
from pydantic import BaseModel, ConfigDict

from app.models.enums import Rank

# Forward reference for recursive model
TaxonRecursive = ForwardRef('TaxonRecursive')

class TaxonBase(BaseModel):
    name: str
    rank: Rank
    description: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None

class TaxonCreate(TaxonBase):
    pass

class TaxonUpdate(TaxonBase):
    name: Optional[str] = None
    rank: Optional[Rank] = None

class TaxonResponse(TaxonBase):
    id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

class TaxonTree(TaxonResponse):
    children: List["TaxonTree"] = []
    
    model_config = ConfigDict(from_attributes=True)

# Resolve forward reference
TaxonTree.model_rebuild()
