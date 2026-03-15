from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from ..database import get_db
from ..models.audit_log import AuditLog
from ..models.user import User

router = APIRouter()

class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    resource_type: str
    resource_id: Optional[str]
    meta: Optional[dict]
    created_at: datetime
    user_email: Optional[str] = None

    class Config:
        from_attributes = True

@router.get("/", response_model=List[AuditLogResponse])
def list_audit_logs(
    resource_type: Optional[str] = None,
    action: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if action:
        query = query.filter(AuditLog.action == action)
        
    logs = query.order_by(AuditLog.created_at.desc()).limit(200).all()
    
    # Enrich with user email if possible
    # This assumes there's a relationship or we do it manually
    enriched = []
    for log in logs:
        # Simple enrichment
        email = None
        if log.user_id:
            u = db.query(User).filter(User.id == log.user_id).first()
            email = u.email if u else None
            
        l_dict = AuditLogResponse.from_orm(log)
        l_dict.user_email = email
        enriched.append(l_dict)
        
    return enriched
