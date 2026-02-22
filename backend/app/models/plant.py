import uuid
from datetime import datetime
from typing import List, Optional, Any

from sqlalchemy import ForeignKey, String, Text, Enum as SAEnum, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import PlantingPlace, Rank
from app.models.taxon import Taxon

class Plant(Base):
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    taxon_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("taxons.id"), nullable=True, index=True)
    scientific_name: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    
    common_name: Mapped[str] = mapped_column(String, index=True, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False, index=True)
    planting_place: Mapped[PlantingPlace] = mapped_column(SAEnum(PlantingPlace), nullable=False, index=True)
    
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    care_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    icon_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    taxon: Mapped["Taxon"] = relationship("Taxon")
    # images: Mapped[List["PlantImage"]] = relationship("PlantImage", back_populates="plant")

    def __repr__(self):
        return f"<Plant(common_name={self.common_name})>"
