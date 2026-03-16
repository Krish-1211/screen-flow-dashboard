# RENDER FREE TIER NOTE:
# This service may spin down after 15 minutes of inactivity on Render's
# free plan. To prevent false "screen offline" alerts, configure a free
# uptime monitoring service (e.g. UptimeRobot at uptimerobot.com) to
# send an HTTP GET request to /health every 5 minutes.
# The /health endpoint is defined in main.py and requires no auth.

import uuid
from datetime import datetime, timedelta
import random
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
    playlist_id: int | None = None


class ScreenHeartbeatPayload(BaseModel):
    device_id: str


class ScreenUpdatePayload(BaseModel):
    name: str | None = None
    current_playlist_id: int | None = None
    status: str | None = None


class BulkAssignRequest(BaseModel):
    screen_ids: List[int]
    playlist_id: int


router = APIRouter()
public_router = APIRouter()


def serialize_screen(screen: Screen) -> dict:
    # Logic: If last_seen is within 60s, it's online, otherwise it's whatever is in the DB
    status = screen.status
    if screen.last_seen:
        is_recent = (datetime.utcnow() - screen.last_seen) < timedelta(seconds=60)
        if is_recent:
            status = "online"
        elif status == "online":
            # If it's stale but says online, it's actually offline
            status = "offline"

    return {
        "id": screen.id,
        "name": screen.name,
        "device_id": screen.device_id,
        "status": status,
        "last_seen": screen.last_seen.isoformat() + "Z" if screen.last_seen else None,
        "playlistId": screen.current_playlist_id,
        "schedule_count": len([s for s in screen.schedules if s.active]) if hasattr(screen, 'schedules') else 0
    }


@router.get("/", response_model=List[dict])
def list_screens(db: Session = Depends(get_db)):
    screens = db.query(Screen).all()
    return [serialize_screen(s) for s in screens]


@router.get("/{screen_id}", response_model=dict)
def get_screen(screen_id: int, db: Session = Depends(get_db)):
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
        current_playlist_id=payload.playlist_id,
        status="offline",
        last_seen=None,
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
    
    screen.last_seen = datetime.utcnow()
    screen.status = "online"
    
    # Check for other screens that went offline
    stale_threshold = datetime.utcnow() - timedelta(seconds=HEARTBEAT_TIMEOUT_SECONDS)
    stale_screens = db.query(Screen).filter(
        Screen.last_seen < stale_threshold,
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
                    "last_seen": s.last_seen.isoformat() + "Z" if s.last_seen else None
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
    return get_screen_playlist(screen.id, db)


@router.put("/{screen_id}", response_model=dict)
def update_screen(
    screen_id: int,
    payload: ScreenUpdatePayload,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    screen = db.query(Screen).filter(Screen.id == screen_id).first()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen not found")

    if payload.name is not None:
        screen.name = payload.name

    if payload.current_playlist_id is not None:
        screen.current_playlist_id = payload.current_playlist_id

    if payload.status is not None:
        screen.status = payload.status
        if payload.status == "offline":
            # Clear last_seen to force immediate offline status
            screen.last_seen = datetime.utcnow() - timedelta(seconds=120)

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

    # Bulk update in transaction
    db.query(Screen).filter(Screen.id.in_(payload.screen_ids)).update(
        {"current_playlist_id": payload.playlist_id},
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
    screen_id: int, 
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
def get_screen_playlist(screen_id: int, db: Session = Depends(get_db)):
    screen = db.query(Screen).filter(Screen.id == screen_id).first()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen not found")

    # Check for active schedule
    now = datetime.utcnow() # Assuming server time is UTC
    current_time = now.time()
    current_day = now.weekday()
    
    active_sch = db.query(Schedule).filter(
        Schedule.screen_id == screen_id,
        Schedule.active == True,
        Schedule.start_time <= current_time,
        Schedule.end_time >= current_time,
        Schedule.days_of_week.any(current_day)
    ).first()

    playlist_id = screen.current_playlist_id
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

