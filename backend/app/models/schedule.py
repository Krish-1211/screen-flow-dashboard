from datetime import datetime
import uuid
from sqlalchemy import Column, String, DateTime, text, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID, ARRAY

from ..database import Base

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    screen_id = Column(UUID(as_uuid=True), nullable=False)
    playlist_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String, nullable=True)
    day = Column(String, nullable=True) # e.g. "Monday" (Keeping for transition)
    start_hour = Column(Integer, nullable=True) # (Keeping for transition)
    end_hour = Column(Integer, nullable=True)   # (Keeping for transition)
    days_of_week = Column(ARRAY(Integer), nullable=True) # Postgres integer array
    start_time = Column(String, nullable=True, default="09:00:00")
    end_time = Column(String, nullable=True, default="17:00:00")
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, server_default=text('now()'), nullable=False)
