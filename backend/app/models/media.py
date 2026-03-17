from datetime import datetime
import uuid
from sqlalchemy import Column, DateTime, String, Numeric, text
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base

class Media(Base):
    __tablename__ = "media"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False) # Maps to 'filename' in old code
    type = Column(String, nullable=False) # Maps to 'file_type' in old code
    url = Column(String, nullable=False)
    duration = Column(Numeric, nullable=True) # Changed from Integer to Numeric
    thumbnail = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, server_default=text('now()'), nullable=False)

