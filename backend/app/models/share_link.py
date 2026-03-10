import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, DateTime
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class ProjectShareLink(Base):
    """
    A time-limited public share link for a project.
    Each project can have at most one active share token (regenerate = overwrite).
    """
    __tablename__ = "project_share_links"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        unique=True,          # one link per project
        nullable=False,
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, server_default=sa.text("now()")
    )

    project: Mapped["Project"] = relationship("Project")  # type: ignore[name-defined]
