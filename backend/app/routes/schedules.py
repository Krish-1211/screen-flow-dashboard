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
    days_of_week: List[int] # [0, 1, 2, 3, 4, 5, 6]
    start_time: str # "HH:MM:SS"
    end_time: str # "HH:MM:SS"
    active: bool = True

class ScheduleCreate(ScheduleBase):
    pass

class ScheduleResponse(BaseModel):
    id: uuid.UUID
    screen_id: uuid.UUID
    playlist_id: uuid.UUID
    name: Optional[str] = None
    days_of_week: List[int]
    start_time: str
    end_time: str
    active: bool
    created_at: datetime

    class Config:
        from_attributes = True

def check_overlap(db: Session, screen_id: uuid.UUID, days_of_week: List[int], start_time: str, end_time: str, exclude_id: Optional[uuid.UUID] = None):
    # This is a bit more complex now. For each day, check if time ranges overlap.
    # For simplicity, we can fetch all schedules for this screen and check in Python.
    query = db.query(Schedule).filter(Schedule.screen_id == screen_id)
    if exclude_id:
        query = query.filter(Schedule.id != exclude_id)
    
    existing = query.all()
    for sch in existing:
        if not sch.days_of_week: continue
        # Intersection of days
        common_days = set(days_of_week).intersection(set(sch.days_of_week))
        if common_days:
            # Check time overlap: (start1 < end2) AND (end1 > start2)
            if start_time < sch.end_time and end_time > sch.start_time:
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

    overlap = check_overlap(db, payload.screen_id, payload.days_of_week, payload.start_time, payload.end_time)
    if overlap:
        raise HTTPException(
            status_code=409, 
            detail=f"Overlaps with existing schedule.")

    db_schedule = Schedule(
        screen_id=payload.screen_id,
        playlist_id=payload.playlist_id,
        name=payload.name,
        days_of_week=payload.days_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
        active=payload.active
    )
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    write_audit_log(db, current_user['id'], "create", "schedule", str(db_schedule.id), meta={"days": db_schedule.days_of_week, "screen_id": str(db_schedule.screen_id)})
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

    overlap = check_overlap(db, payload.screen_id, payload.days_of_week, payload.start_time, payload.end_time, exclude_id=schedule_id)
    if overlap:
        raise HTTPException(
            status_code=409, 
            detail=f"Overlaps with existing schedule."
        )

    db_schedule.screen_id = payload.screen_id
    db_schedule.playlist_id = payload.playlist_id
    db_schedule.name = payload.name
    db_schedule.days_of_week = payload.days_of_week
    db_schedule.start_time = payload.start_time
    db_schedule.end_time = payload.end_time
    db_schedule.active = payload.active

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
    current_time = now.strftime("%H:%M:%S")
    current_day_idx = now.weekday() # 0-6 (Mon-Sun)

    # Note: Use PostgreSQL 'ANY' for array check
    schedules = db.query(Schedule).filter(
        Schedule.screen_id == screen_id,
        Schedule.active == True,
        text(":day = ANY(days_of_week)").bindparams(day=current_day_idx),
        Schedule.start_time <= current_time,
        Schedule.end_time > current_time,
    ).first()
    
    return schedules
