from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from ..database import Base


class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    items = relationship("PlaylistItem", back_populates="playlist", cascade="all, delete-orphan")


class PlaylistItem(Base):
    __tablename__ = "playlist_items"

    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id", ondelete="CASCADE"))
    media_id = Column(Integer, ForeignKey("media.id", ondelete="CASCADE"))
    duration = Column(Integer, nullable=True)
    position = Column(Integer, nullable=False)

    playlist = relationship("Playlist", back_populates="items")

