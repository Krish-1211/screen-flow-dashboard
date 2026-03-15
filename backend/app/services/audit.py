from sqlalchemy.orm import Session
from ..models.audit_log import AuditLog

def write_audit_log(db: Session, user_id: int, action: str, resource_type: str, resource_id: str | int | None, meta: dict | None = None):
    log = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        meta=meta
    )
    db.add(log)
    db.commit()
