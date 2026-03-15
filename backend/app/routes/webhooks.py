from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, HttpUrl

from ..database import get_db
from ..models.webhook import Webhook
from ..auth import get_current_user
from ..services.audit import write_audit_log

router = APIRouter()

class WebhookBase(BaseModel):
    url: HttpUrl
    secret: str | None = None
    events: List[str] = ["screen.offline"]
    enabled: bool = True

class WebhookCreate(WebhookBase):
    pass

class WebhookResponse(WebhookBase):
    id: int

    class Config:
        from_attributes = True

@router.get("/", response_model=List[WebhookResponse])
def list_webhooks(db: Session = Depends(get_db)):
    return db.query(Webhook).all()

@router.post("/", response_model=WebhookResponse)
def create_webhook(
    payload: WebhookCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Convert Pydantic HttpUrl to string for DB
    webhook_data = payload.dict()
    webhook_data['url'] = str(webhook_data['url'])
    
    db_webhook = Webhook(**webhook_data)
    db.add(db_webhook)
    db.commit()
    db.refresh(db_webhook)
    write_audit_log(db, current_user['id'], "create", "webhook", db_webhook.id, meta={"url": db_webhook.url})
    return db_webhook

@router.put("/{webhook_id}", response_model=WebhookResponse)
def update_webhook(
    webhook_id: int, 
    payload: WebhookCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not db_webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    update_data = payload.dict(exclude_unset=True)
    if 'url' in update_data:
        update_data['url'] = str(update_data['url'])
        
    for key, value in update_data.items():
        setattr(db_webhook, key, value)
    
    db.commit()
    db.refresh(db_webhook)
    write_audit_log(db, current_user['id'], "update", "webhook", db_webhook.id, meta=payload.dict(exclude_unset=True))
    return db_webhook

@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(
    webhook_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not db_webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    db.delete(db_webhook)
    db.commit()
    write_audit_log(db, current_user['id'], "delete", "webhook", webhook_id)
