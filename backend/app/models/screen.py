from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from ..database import Base


class Screen(Base):
    __tablename__ = "screens"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    device_id = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="offline", nullable=False)
    last_seen = Column(DateTime, default=datetime.utcnow, nullable=False)
    current_playlist_id = Column(Integer, nullable=True)
    pairing_code = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

