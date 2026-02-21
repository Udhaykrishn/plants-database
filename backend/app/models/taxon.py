import uuid
from typing import List, Optional

from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, Enum as SAEnum, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import Rank

class Taxon(Base):
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, index=True, nullable=False)
    rank: Mapped[Rank] = mapped_column(SAEnum(Rank), nullable=False, index=True)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("taxons.id"), nullable=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Self-referencing relationship
    parent: Mapped[Optional["Taxon"]] = relationship("Taxon", remote_side=[id], back_populates="children")
    children: Mapped[List["Taxon"]] = relationship("Taxon", back_populates="parent")

    def __repr__(self):
        return f"<Taxon(name={self.name}, rank={self.rank})>"
