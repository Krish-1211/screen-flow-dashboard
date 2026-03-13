from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Integer, String

from ..database import Base


class License(Base):
    __tablename__ = "licenses"

    id = Column(Integer, primary_key=True, index=True)
    license_key = Column(String, unique=True, index=True, nullable=False)
    max_screens = Column(Integer, nullable=False)
    expiry_date = Column(Date, nullable=False)
    signature = Column(String, nullable=False)
    licensee = Column(String, nullable=True)
    tier = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

