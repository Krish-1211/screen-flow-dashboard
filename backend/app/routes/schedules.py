import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models.schedule import Schedule
from ..models.playlist import Playlist
from ..models.screen import Screen
from ..auth import get_current_user
from ..services.audit import write_audit_log

router = APIRouter()

class ScheduleBase(BaseModel):
    screen_id: uuid.UUID
    playlist_id: uuid.UUID
    name: Optional[str] = None
    day: str # Monday, Tuesday, etc.
    start_hour: int
    end_hour: int

class ScheduleCreate(ScheduleBase):
    pass

class ScheduleResponse(BaseModel):
    id: uuid.UUID
    screen_id: uuid.UUID
    playlist_id: uuid.UUID
    name: Optional[str] = None
    day: str
    start_hour: int
    end_hour: int
    created_at: datetime

    class Config:
        from_attributes = True

def check_overlap(db: Session, screen_id: uuid.UUID, day: str, start_hour: int, end_hour: int, exclude_id: Optional[uuid.UUID] = None):
    query = db.query(Schedule).filter(
        Schedule.screen_id == screen_id,
        Schedule.day == day
    )
    if exclude_id:
        query = query.filter(Schedule.id != exclude_id)
    
    existing = query.all()
    for sch in existing:
        # Overlap check: (start1 < end2) AND (end1 > start2)
        if start_hour < sch.end_hour and end_hour > sch.start_hour:
            return sch
    return None

@router.get("/", response_model=List[ScheduleResponse])
def list_schedules(screen_id: Optional[uuid.UUID] = None, db: Session = Depends(get_db)):
    query = db.query(Schedule)
    if screen_id:
        query = query.filter(Schedule.screen_id == screen_id)
    return query.all()

@router.post("/", response_model=ScheduleResponse)
def create_schedule(
    payload: ScheduleCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Validate screen and playlist
    if not db.query(Screen).filter(Screen.id == payload.screen_id).first():
        raise HTTPException(status_code=404, detail="Screen not found")
    if not db.query(Playlist).filter(Playlist.id == payload.playlist_id).first():
        raise HTTPException(status_code=404, detail="Playlist not found")

    overlap = check_overlap(db, payload.screen_id, payload.day, payload.start_hour, payload.end_hour)
    if overlap:
        raise HTTPException(
            status_code=409, 
            detail=f"Overlaps with existing schedule for {payload.day}.")

    db_schedule = Schedule(
        screen_id=payload.screen_id,
        playlist_id=payload.playlist_id,
        name=payload.name,
        day=payload.day,
        start_hour=payload.start_hour,
        end_hour=payload.end_hour
    )
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    write_audit_log(db, current_user['id'], "create", "schedule", str(db_schedule.id), meta={"day": db_schedule.day, "screen_id": str(db_schedule.screen_id)})
    return db_schedule

@router.put("/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(
    schedule_id: uuid.UUID, 
    payload: ScheduleCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    overlap = check_overlap(db, payload.screen_id, payload.day, payload.start_hour, payload.end_hour, exclude_id=schedule_id)
    if overlap:
        raise HTTPException(
            status_code=409, 
            detail=f"Overlaps with existing schedule for {payload.day}."
        )

    db_schedule.screen_id = payload.screen_id
    db_schedule.playlist_id = payload.playlist_id
    db_schedule.name = payload.name
    db_schedule.day = payload.day
    db_schedule.start_hour = payload.start_hour
    db_schedule.end_hour = payload.end_hour

    db.commit()
    db.refresh(db_schedule)
    write_audit_log(db, current_user['id'], "update", "schedule", str(db_schedule.id), meta=payload.dict(exclude_unset=True))
    return db_schedule

@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(
    schedule_id: uuid.UUID, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    db.delete(db_schedule)
    db.commit()
    write_audit_log(db, current_user['id'], "delete", "schedule", str(schedule_id))

@router.get("/active", response_model=Optional[ScheduleResponse])
def get_active_schedule(screen_id: uuid.UUID, db: Session = Depends(get_db)):
    now = datetime.now()
    current_hour = now.hour
    current_day_name = now.strftime("%A")

    schedule = db.query(Schedule).filter(
        Schedule.screen_id == screen_id,
        Schedule.day == current_day_name,
        Schedule.start_hour <= current_hour,
        Schedule.end_hour > current_hour,
    ).first()
    
    return schedule
