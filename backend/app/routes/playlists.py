import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.media import Media
from ..models.playlist import Playlist
from ..auth import get_current_user
from ..services.audit import write_audit_log
from ..services.storage import get_presigned_url, get_proxy_url


class PlaylistItemPayload(BaseModel):
    media_id: uuid.UUID
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
    try:
        items = pl.items if isinstance(pl.items, list) else []
        result_items: list[dict] = []
        
        # Enrich items with media details
        for i, item in enumerate(items):
            try:
                media_id = item.get("media_id")
                media = db.query(Media).filter(Media.id == media_id).first()
                result_items.append(
                    {
                        "id": i, # Dummy ID for backward compatibility with React keys
                        "media_id": str(media_id) if media_id else None,
                        "duration": item.get("duration"),
                        "position": item.get("position", i),
                        "media": {
                            "id": str(media.id) if media and media.id else "",
                            "name": media.name if media else "Deleted Media",
                            "type": "video" if media and media.type and media.type.startswith("video") else "image",
                            "url": get_proxy_url(media.name) if media and media.name else None,
                        }
                        if media
                        else None,
                    }
                )
            except Exception as item_error:
                print(f"[PLAYLIST] Error enriching item {i}: {item_error}")
                continue

        created_at_str = ""
        if pl.created_at:
            created_at_str = pl.created_at.isoformat()
            if not created_at_str.endswith('Z') and '+' not in created_at_str:
                created_at_str += 'Z'

        return {
            "id": str(pl.id) if pl.id else "",
            "name": pl.name or "Unnamed Playlist",
            "created_at": created_at_str,
            "items": result_items,
        }
    except Exception as e:
        print(f"[PLAYLIST] Serialization error for {pl.id if pl else 'unknown'}: {e}")
        return {
            "id": str(pl.id) if pl and pl.id else "",
            "name": "Error Loading Playlist",
            "items": []
        }


@router.get("/", response_model=List[dict])
def list_playlists(db: Session = Depends(get_db)):
    playlists = db.query(Playlist).order_by(Playlist.created_at.desc()).all()
    return [serialize_playlist(pl, db) for pl in playlists]


@router.get("/{playlist_id}", response_model=dict)
def get_playlist(playlist_id: str, db: Session = Depends(get_db)):
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
    items_json = [item.dict(exclude_unset=True) for item in payload.items]
    # Convert media_id UUID to string for JSON storage
    for item in items_json:
        item["media_id"] = str(item["media_id"])

    pl = Playlist(name=payload.name, items=items_json)
    db.add(pl)
    db.commit()
    db.refresh(pl)
    write_audit_log(db, current_user['id'], "create", "playlist", str(pl.id), meta={"name": pl.name})
    return serialize_playlist(pl, db)


@router.put("/{playlist_id}", response_model=dict)
def update_playlist(
    playlist_id: str,
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
        items_json = [item.dict(exclude_unset=True) for item in payload.items]
        for item in items_json:
            item["media_id"] = str(item["media_id"])
        pl.items = items_json

    db.commit()
    db.refresh(pl)
    write_audit_log(db, current_user['id'], "update", "playlist", str(pl.id), meta=payload.dict(exclude_unset=True))
    return serialize_playlist(pl, db)


@router.post("/{playlist_id}/items", response_model=dict)
def add_items(
    playlist_id: str,
    items: List[PlaylistItemPayload],
    db: Session = Depends(get_db),
):
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")

    current_items = list(pl.items) if pl.items else []
    for item in items:
        item_data = item.dict(exclude_unset=True)
        item_data["media_id"] = str(item_data["media_id"])
        current_items.append(item_data)
    
    pl.items = current_items
    db.commit()
    db.refresh(pl)
    return serialize_playlist(pl, db)


@router.delete("/{playlist_id}", status_code=204)
def delete_playlist(
    playlist_id: str, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    db.delete(pl)
    db.commit()
    
    write_audit_log(db, current_user['id'], "delete", "playlist", playlist_id)

