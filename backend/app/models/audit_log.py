from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from datetime import datetime
from ..database import Base

class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    action = Column(String(50), nullable=False) # e.g. "update", "delete", "create"
    resource_type = Column(String(50), nullable=False) # e.g. "screen", "playlist", "webhook"
    resource_id = Column(String(100), nullable=True)
    meta = Column(JSON, nullable=True) # For diffs or extra info
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
