from typing import List, Optional
from datetime import datetime, time, date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from pydantic import BaseModel, field_validator, ValidationInfo

from ..database import get_db
from ..models.schedule import Schedule
from ..models.playlist import Playlist
from ..models.screen import Screen
from ..auth import get_current_user
from ..services.audit import write_audit_log

router = APIRouter()

class ScheduleBase(BaseModel):
    screen_id: int
    playlist_id: int
    name: Optional[str] = None
    start_time: str # format HH:MM
    end_time: str   # format HH:MM
    days_of_week: List[int]
    active: bool = True

    @field_validator('start_time', 'end_time')
    @classmethod
    def validate_time(cls, v: str) -> time:
        try:
            return datetime.strptime(v, "%H:%M").time()
        except ValueError:
            raise ValueError("Time must be in HH:MM format")

    @field_validator('end_time')
    @classmethod
    def validate_end_after_start(cls, v: time, info: ValidationInfo) -> time:
        if 'start_time' in info.data and v <= info.data['start_time']:
            raise ValueError("end_time must be after start_time")
        return v

class ScheduleCreate(ScheduleBase):
    pass

class ScheduleResponse(BaseModel):
    id: int
    screen_id: int
    playlist_id: int
    name: Optional[str]
    start_time: time
    end_time: time
    days_of_week: List[int]
    active: bool
    created_at: datetime

    class Config:
        from_attributes = True

def check_overlap(db: Session, screen_id: int, start_time: time, end_time: time, days: List[int], exclude_id: Optional[int] = None):
    # Find active schedules for the same screen on same days
    query = db.query(Schedule).filter(
        Schedule.screen_id == screen_id,
        Schedule.active == True,
    )
    if exclude_id:
        query = query.filter(Schedule.id != exclude_id)
    
    existing = query.all()
    for sch in existing:
        # Check day overlap
        day_overlap = any(d in sch.days_of_week for d in days)
        if day_overlap:
            # Check time overlap
            # (start1 < end2) AND (end1 > start2)
            if start_time < sch.end_time and end_time > sch.start_time:
                return sch
    return None

@router.get("/", response_model=List[ScheduleResponse])
def list_schedules(screen_id: Optional[int] = None, db: Session = Depends(get_db)):
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

    overlap = check_overlap(db, payload.screen_id, payload.start_time, payload.end_time, payload.days_of_week)
    if overlap:
        raise HTTPException(
            status_code=409, 
            detail=f"Schedule overlaps with existing schedule '{overlap.name or 'Unnamed'}'.")

    db_schedule = Schedule(
        screen_id=payload.screen_id,
        playlist_id=payload.playlist_id,
        name=payload.name,
        start_time=payload.start_time,
        end_time=payload.end_time,
        days_of_week=payload.days_of_week,
        active=payload.active
    )
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    write_audit_log(db, current_user['id'], "create", "schedule", db_schedule.id, meta={"name": db_schedule.name, "screen_id": db_schedule.screen_id})
    return db_schedule

@router.put("/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(
    schedule_id: int, 
    payload: ScheduleCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if payload.active:
        overlap = check_overlap(db, payload.screen_id, payload.start_time, payload.end_time, payload.days_of_week, exclude_id=schedule_id)
        if overlap:
            raise HTTPException(
                status_code=409, 
                detail=f"Schedule overlaps with existing schedule '{overlap.name or 'Unnamed'}'."
            )

    db_schedule.screen_id = payload.screen_id
    db_schedule.playlist_id = payload.playlist_id
    db_schedule.name = payload.name
    db_schedule.start_time = payload.start_time
    db_schedule.end_time = payload.end_time
    db_schedule.days_of_week = payload.days_of_week
    db_schedule.active = payload.active

    db.commit()
    db.refresh(db_schedule)
    write_audit_log(db, current_user['id'], "update", "schedule", db_schedule.id, meta=payload.dict(exclude_unset=True))
    return db_schedule

@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(
    schedule_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    db.delete(db_schedule)
    db.commit()
    write_audit_log(db, current_user['id'], "delete", "schedule", schedule_id)

@router.get("/active", response_model=Optional[ScheduleResponse])
def get_active_schedule(screen_id: int, db: Session = Depends(get_db)):
    now = datetime.now()
    current_time = now.time()
    current_day = now.weekday() # 0 = Monday

    schedule = db.query(Schedule).filter(
        Schedule.screen_id == screen_id,
        Schedule.active == True,
        Schedule.start_time <= current_time,
        Schedule.end_time >= current_time,
        Schedule.days_of_week.contains([current_day])
    ).first()
    
    return schedule
