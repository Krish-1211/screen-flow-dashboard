from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime
from ..database import Base

class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(500), nullable=False)
    secret = Column(String(200), nullable=True)
    # Using String for events array as standard SQL doesn't handle [] well in all dialects
    # but the prompt specifies events VARCHAR(100)[]
    events = Column(ARRAY(String), nullable=False, default=['screen.offline'])
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
