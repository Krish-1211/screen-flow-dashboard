from datetime import datetime, timedelta
import random
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.screen import Screen
from ..models.license import License
from ..services.license_service import load_and_validate_license
from ..models.playlist import Playlist


class ScreenRegisterPayload(BaseModel):
    device_id: str
    name: str | None = None


class ScreenHeartbeatPayload(BaseModel):
    device_id: str


class ScreenUpdatePayload(BaseModel):
    name: str | None = None
    current_playlist_id: int | None = None


router = APIRouter()


def serialize_screen(screen: Screen) -> dict:
    return {
        "id": screen.id,
        "name": screen.name,
        "device_id": screen.device_id,
        "status": screen.status,
        "last_seen": screen.last_seen.isoformat() if screen.last_seen else None,
        "playlistId": screen.current_playlist_id,
    }


@router.get("/", response_model=List[dict])
def list_screens(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    screens = db.query(Screen).all()
    for s in screens:
        if s.last_seen and now - s.last_seen > timedelta(seconds=60):
            s.status = "offline"
    db.commit()
    return [serialize_screen(s) for s in screens]


@router.get("/{screen_id}", response_model=dict)
def get_screen(screen_id: int, db: Session = Depends(get_db)):
    s = db.query(Screen).filter(Screen.id == screen_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Screen not found")
    return serialize_screen(s)


@router.post("/register", response_model=dict)
def register_screen(payload: ScreenRegisterPayload, db: Session = Depends(get_db)):
    existing = db.query(Screen).filter(Screen.device_id == payload.device_id).first()
    if existing:
        return {
            "screen_id": existing.id,
            "playlist": existing.current_playlist_id,
        }

    # Enforce license limits
    active_license = db.query(License).first()
    if not active_license:
        # Try to load from license.json for local deployments
        try:
            info = load_and_validate_license(Path("license.json"))
            if not info.valid:
                raise HTTPException(status_code=403, detail="invalid license")
            active_license = License(
                license_key="local",
                max_screens=info.max_screens,
                expiry_date=info.expiry_date,
                signature="",
                licensee=info.licensee,
                tier=info.tier,
            )
            db.add(active_license)
            db.commit()
        except Exception:
            raise HTTPException(status_code=403, detail="license missing")

    # count existing screens
    screen_count = db.query(Screen).count()
    if screen_count >= active_license.max_screens:
        raise HTTPException(status_code=403, detail="screen limit reached")

    name = payload.name or f"Screen-{random.randint(1000, 9999)}"
    screen = Screen(
        name=name,
        device_id=payload.device_id,
        status="online",
        last_seen=datetime.utcnow(),
    )
    db.add(screen)
    db.commit()
    db.refresh(screen)
    return {
        "screen_id": screen.id,
        "playlist": screen.current_playlist_id,
    }


@router.post("/heartbeat", response_model=dict)
def heartbeat(payload: ScreenHeartbeatPayload, db: Session = Depends(get_db)):
    screen = (
        db.query(Screen).filter(Screen.device_id == payload.device_id).first()
    )
    if not screen:
        raise HTTPException(status_code=404, detail="Screen not registered")
    screen.last_seen = datetime.utcnow()
    screen.status = "online"
    db.commit()
    return serialize_screen(screen)


@router.put("/{screen_id}", response_model=dict)
def update_screen(
    screen_id: int,
    payload: ScreenUpdatePayload,
    db: Session = Depends(get_db),
):
    screen = db.query(Screen).filter(Screen.id == screen_id).first()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen not found")

    if payload.name is not None:
        screen.name = payload.name

    if payload.current_playlist_id is not None:
        # ensure playlist exists
        if (
            db.query(Playlist)
            .filter(Playlist.id == payload.current_playlist_id)
            .first()
            is None
        ):
            raise HTTPException(status_code=400, detail="Playlist not found")
        screen.current_playlist_id = payload.current_playlist_id

    db.commit()
    db.refresh(screen)
    return serialize_screen(screen)


@router.delete("/{screen_id}", status_code=204)
def delete_screen(screen_id: int, db: Session = Depends(get_db)):
    s = db.query(Screen).filter(Screen.id == screen_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Screen not found")
    db.delete(s)
    db.commit()

