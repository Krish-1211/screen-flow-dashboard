from sqlalchemy import Column, Integer, String, Boolean, DateTime, Time, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime
from ..database import Base

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    screen_id = Column(Integer, ForeignKey("screens.id", ondelete="CASCADE"), nullable=False, index=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    days_of_week = Column(ARRAY(Integer), nullable=False) # 0=Mon, 6=Sun
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint('end_time > start_time', name='chk_time_order'),
    )
