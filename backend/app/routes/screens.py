from datetime import datetime, timedelta, timezone
import random
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, Response, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db
from ..models.screen import Screen
from ..models.license import License
from ..services.license_service import load_and_validate_license
from ..models.playlist import Playlist
from .playlists import serialize_playlist
from pathlib import Path
from ..models.webhook import Webhook
from ..models.schedule import Schedule
from ..services.webhook_dispatcher import dispatch_webhook
from ..services.audit import write_audit_log
from ..auth import get_current_user
from ..models.webhook import Webhook
from ..models.schedule import Schedule
from ..services.webhook_dispatcher import dispatch_webhook

HEARTBEAT_TIMEOUT_SECONDS = 60


class ScreenRegisterPayload(BaseModel):
    name: str
    playlist_id: uuid.UUID | None = None


class ScreenHeartbeatPayload(BaseModel):
    device_id: str


class ScreenUpdatePayload(BaseModel):
    name: str | None = None
    playlist_id: uuid.UUID | None = None
    status: str | None = None


class BulkAssignRequest(BaseModel):
    screen_ids: List[uuid.UUID]
    playlist_id: uuid.UUID


router = APIRouter()
public_router = APIRouter()


def serialize_screen(screen: Screen) -> dict:
    try:
        status = screen.status
        uploaded_at = ""
        last_ping_str = None

        if screen.last_ping:
            # DB may store timezone-aware or naive. Ensure we compare aware to aware.
            last_ping = screen.last_ping
            if last_ping.tzinfo is None:
                 last_ping = last_ping.replace(tzinfo=timezone.utc)
                 
            now = datetime.now(timezone.utc)
            is_recent = (now - last_ping) < timedelta(seconds=60)
            if is_recent:
                status = "online"
            elif status == "online":
                status = "offline"
            
            # Format reliably for ISO
            last_ping_str = last_ping.isoformat()
            if not last_ping_str.endswith('Z') and '+' not in last_ping_str:
                last_ping_str += 'Z'

        created_at_str = ""
        if screen.created_at:
            created_at_str = screen.created_at.isoformat()
            if not created_at_str.endswith('Z') and '+' not in created_at_str:
                created_at_str += 'Z'

        return {
            "id": str(screen.id) if screen.id else "",
            "name": screen.name or "Unnamed",
            "device_id": screen.device_id or "",
            "status": status or "offline",
            "lastPing": last_ping_str,
            "playlistId": str(screen.playlist_id) if screen.playlist_id else None,
            "created_at": created_at_str
        }
    except Exception as e:
        print(f"[SCREEN] Serialization error: {e}")
        # Return a minimal safe dictionary instead of crashing
        return {
            "id": str(screen.id) if screen.id else "",
            "name": "Error Loading",
            "status": "error",
            "id_error": str(e)
        }


@router.get("/", response_model=List[dict])
def list_screens(db: Session = Depends(get_db)):
    screens = db.query(Screen).all()
    return [serialize_screen(s) for s in screens]


@router.get("/{screen_id}", response_model=dict)
def get_screen(screen_id: str, db: Session = Depends(get_db)):
    s = db.query(Screen).filter(Screen.id == screen_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Screen not found")
    return serialize_screen(s)


@router.post("/register", response_model=dict)
def register_screen(
    payload: ScreenRegisterPayload,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Enforce license limits
    active_license = db.query(License).first()
    if not active_license:
        active_license = License(
            license_key="dev-local",
            max_screens=100,
            expiry_date=datetime(2099, 1, 1).date(),
            signature="dev",
            licensee="Developer",
            tier="Growth",
        )
        db.add(active_license)
        db.commit()
        db.refresh(active_license)

    screen_count = db.query(Screen).count()
    if screen_count >= active_license.max_screens:
        raise HTTPException(status_code=403, detail="screen limit reached")

    device_id = str(uuid.uuid4())
    
    new_screen = Screen(
        name=payload.name,
        device_id=device_id,
        playlist_id=payload.playlist_id,
        status="offline",
        last_ping=None,
    )
    db.add(new_screen)
    db.commit()
    db.refresh(new_screen)

    write_audit_log(db, current_user['id'], "register", "screen", new_screen.id, meta={"device_id": device_id})

    return serialize_screen(new_screen)


@public_router.post("/heartbeat", response_model=dict)
async def heartbeat(
    payload: ScreenHeartbeatPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    device_id = payload.device_id
    screen = db.query(Screen).filter(Screen.device_id == device_id).first()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen not registered")
    
    now = datetime.now(timezone.utc)
    screen.last_ping = now
    screen.status = "online"
    
    # Check for other screens that went offline
    stale_threshold = now - timedelta(seconds=HEARTBEAT_TIMEOUT_SECONDS)
    stale_screens = db.query(Screen).filter(
        Screen.last_ping < stale_threshold,
        Screen.status != "offline"
    ).all()

    if stale_screens:
        # Get active webhooks for screen.offline
        webhooks = db.query(Webhook).filter(
            Webhook.enabled == True,
            text("'screen.offline' = ANY(events)")
        ).all()

        for s in stale_screens:
            s.status = "offline"
            # Trigger webhooks
            for wh in webhooks:
                payload_wh = {
                    "event": "screen.offline",
                    "screen_id": s.id,
                    "screen_name": s.name,
                    "last_seen": s.last_ping.isoformat() + "Z" if s.last_ping else None
                }
                background_tasks.add_task(dispatch_webhook, wh.url, wh.secret, payload_wh)

    db.commit()
    return serialize_screen(screen)


@public_router.get("/player", response_model=dict)
async def get_player_config(device_id: str, db: Session = Depends(get_db)):
    screen = db.query(Screen).filter(Screen.device_id == device_id).first()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen not found")

    # Reuse the playlist logic
    return get_screen_playlist(str(screen.id), db)


@router.put("/{screen_id}", response_model=dict)
def update_screen(
    screen_id: str,
    payload: ScreenUpdatePayload,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    screen = db.query(Screen).filter(Screen.id == screen_id).first()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen not found")

    if payload.name is not None:
        screen.name = payload.name

    if payload.playlist_id is not None:
        screen.playlist_id = payload.playlist_id

    if payload.status is not None:
        screen.status = payload.status
        if payload.status == "offline":
            screen.last_ping = datetime.now(timezone.utc) - timedelta(seconds=120)

    db.commit()
    db.refresh(screen)
    
    write_audit_log(db, current_user['id'], "update", "screen", screen.id, meta=payload.dict(exclude_unset=True))
    
    return serialize_screen(screen)


@router.put("/bulk", response_model=dict)
def bulk_assign_playlist(
    payload: BulkAssignRequest, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if not 1 <= len(payload.screen_ids) <= 100:
        raise HTTPException(status_code=400, detail="Must provide between 1 and 100 screen IDs")


    # Validate playlist
    if not db.query(Playlist).filter(Playlist.id == payload.playlist_id).first():
        raise HTTPException(status_code=404, detail=f"Playlist {payload.playlist_id} not found")

    # Bulk update
    db.query(Screen).filter(Screen.id.in_(payload.screen_ids)).update(
        {"playlist_id": payload.playlist_id},
        synchronize_session=False
    )
    db.commit()

    write_audit_log(db, current_user['id'], "bulk_assign", "screen", None, meta={
        "screen_ids": payload.screen_ids,
        "playlist_id": payload.playlist_id,
        "updated_count": len(payload.screen_ids)
    })

    return {"updated": len(payload.screen_ids), "playlist_id": payload.playlist_id}


@router.delete("/{screen_id}", status_code=204)
def delete_screen(
    screen_id: str, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    s = db.query(Screen).filter(Screen.id == screen_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Screen not found")
    
    db.delete(s)
    db.commit()
    
    write_audit_log(db, current_user['id'], "delete", "screen", screen_id)


@public_router.get("/{screen_id}/playlist", response_model=dict)
def get_screen_playlist(screen_id: str, db: Session = Depends(get_db)):
    screen = db.query(Screen).filter(Screen.id == screen_id).first()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen not found")

    # Check for active schedule
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    current_day_name = now.strftime("%A") # Monday, Tuesday, etc.
    
    active_sch = db.query(Schedule).filter(
        Schedule.screen_id == screen.id,
        Schedule.day == current_day_name,
        Schedule.start_hour <= current_hour,
        Schedule.end_hour > current_hour
    ).first()

    playlist_id = screen.playlist_id
    source = "default"
    schedule_name = None

    if active_sch:
        playlist_id = active_sch.playlist_id
        source = "schedule"
        schedule_name = active_sch.name

    if not playlist_id:
        return {
            "id": None, 
            "name": "No Playlist", 
            "items": [], 
            "source": source, 
            "schedule_name": schedule_name
        }

    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")

    data = serialize_playlist(pl, db)
    data["source"] = source
    data["schedule_name"] = schedule_name
    return data

