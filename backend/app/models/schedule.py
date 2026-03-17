from datetime import datetime
import uuid
from sqlalchemy import Column, String, DateTime, text, Integer
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    screen_id = Column(UUID(as_uuid=True), nullable=False)
    playlist_id = Column(UUID(as_uuid=True), nullable=False)
    day = Column(String, nullable=False) # e.g. "Monday"
    start_hour = Column(Integer, nullable=False) # int4 in Supabase
    end_hour = Column(Integer, nullable=False)   # int4 in Supabase
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, server_default=text('now()'), nullable=False)
