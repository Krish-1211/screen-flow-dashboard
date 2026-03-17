from datetime import datetime
import uuid
from sqlalchemy import Column, DateTime, String, text
from sqlalchemy.dialects.postgresql import UUID, JSONB

from ..database import Base

class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    items = Column(JSONB, default=[], nullable=False) # List of media objects
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, server_default=text('now()'), nullable=False)

