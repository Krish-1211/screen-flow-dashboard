from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.media import Media
from ..models.playlist import Playlist, PlaylistItem
from ..auth import get_current_user
from ..services.audit import write_audit_log
from ..services.storage import get_presigned_url


class PlaylistItemPayload(BaseModel):
    media_id: int
    duration: int | None = None
    position: int


class PlaylistCreatePayload(BaseModel):
    name: str
    items: List[PlaylistItemPayload] = []


class PlaylistUpdatePayload(BaseModel):
    name: str | None = None
    items: List[PlaylistItemPayload] | None = None


router = APIRouter()


def serialize_playlist(pl: Playlist, db: Session) -> dict:
    items = (
        db.query(PlaylistItem)
        .filter(PlaylistItem.playlist_id == pl.id)
        .order_by(PlaylistItem.position.asc())
        .all()
    )
    result_items: list[dict] = []
    for item in items:
        media = db.query(Media).filter(Media.id == item.media_id).first()
        result_items.append(
            {
                "id": item.id,
                "media_id": item.media_id,
                "duration": item.duration,
                "position": item.position,
                "media": {
                    "id": media.id,
                    "name": media.filename,
                    "type": "video"
                    if media.file_type.startswith("video")
                    else "image",
                    "url": get_presigned_url(media.filename) if media.filename else None,
                }
                if media
                else None,
            }
        )
    return {
        "id": pl.id,
        "name": pl.name,
        "created_at": pl.created_at.isoformat() + "Z",
        "items": result_items,
    }


@router.get("/", response_model=List[dict])
def list_playlists(db: Session = Depends(get_db)):
    playlists = db.query(Playlist).order_by(Playlist.created_at.desc()).all()
    return [serialize_playlist(pl, db) for pl in playlists]


@router.get("/{playlist_id}", response_model=dict)
def get_playlist(playlist_id: int, db: Session = Depends(get_db)):
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return serialize_playlist(pl, db)


@router.post("/", response_model=dict)
def create_playlist(
    payload: PlaylistCreatePayload, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    pl = Playlist(name=payload.name)
    db.add(pl)
    db.flush()

    for item in payload.items:
        db.add(
            PlaylistItem(
                playlist_id=pl.id,
                media_id=item.media_id,
                duration=item.duration,
                position=item.position,
            )
        )

    db.commit()
    db.refresh(pl)
    write_audit_log(db, current_user['id'], "create", "playlist", pl.id, meta={"name": pl.name})
    return serialize_playlist(pl, db)


@router.put("/{playlist_id}", response_model=dict)
def update_playlist(
    playlist_id: int,
    payload: PlaylistUpdatePayload,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if payload.name is not None:
        pl.name = payload.name

    if payload.items is not None:
        # Clear existing items
        db.query(PlaylistItem).filter(PlaylistItem.playlist_id == playlist_id).delete()
        # Add new items
        for item in payload.items:
            db.add(
                PlaylistItem(
                    playlist_id=playlist_id,
                    media_id=item.media_id,
                    duration=item.duration,
                    position=item.position,
                )
            )

    db.commit()
    db.refresh(pl)
    write_audit_log(db, current_user['id'], "update", "playlist", pl.id, meta=payload.dict(exclude_unset=True))
    return serialize_playlist(pl, db)


@router.post("/{playlist_id}/items", response_model=dict)
def add_items(
    playlist_id: int,
    items: List[PlaylistItemPayload],
    db: Session = Depends(get_db),
):
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")

    for item in items:
        db.add(
            PlaylistItem(
                playlist_id=playlist_id,
                media_id=item.media_id,
                duration=item.duration,
                position=item.position,
            )
        )

    db.commit()
    db.refresh(pl)
    return serialize_playlist(pl, db)


@router.delete("/{playlist_id}", status_code=204)
def delete_playlist(
    playlist_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    db.delete(pl)
    db.commit()
    
    write_audit_log(db, current_user['id'], "delete", "playlist", playlist_id)

