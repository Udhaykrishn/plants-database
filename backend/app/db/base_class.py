import uuid
from typing import Any

from sqlalchemy.ext.declarative import as_declarative, declared_attr
from sqlalchemy.orm import Mapped, mapped_column


@as_declarative()
class Base:
    id: Any
    __name__: str

    # Generate __tablename__ automatically using lowercase class name + 's' is naive, 
    # but for explicit control we can override in models. 
    # Here we default to lowercase class name.
    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__.lower() + "s"
