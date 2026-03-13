from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from ..database import Base


class Media(Base):
    __tablename__ = "media"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    url = Column(String, nullable=False)
    duration = Column(Integer, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

