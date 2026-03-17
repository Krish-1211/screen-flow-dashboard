from datetime import datetime
import uuid
from sqlalchemy import Column, DateTime, String, text
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base

class Screen(Base):
    __tablename__ = "screens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    # device_id: kept for app pairing logic even if not in the screenshot 'quick view'
    device_id = Column(String, unique=True, index=True, nullable=True) 
    status = Column(String, default="offline", nullable=False)
    last_ping = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=True)
    playlist_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, server_default=text('now()'), nullable=False)

