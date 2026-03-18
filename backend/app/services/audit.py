import json
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from ..models.audit_log import AuditLog

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, (datetime)):
        return obj.isoformat()
    if isinstance(obj, uuid.UUID):
        return str(obj)
    raise TypeError(f"Type {type(obj)} not serializable")

def write_audit_log(db: Session, user_id: int, action: str, resource_type: str, resource_id: str | int | None, meta: dict | None = None):
    # Ensure meta is JSON serializable
    safe_meta = None
    if meta is not None:
        try:
            # Round-trip through JSON with our serialiser to clean it up
            safe_meta = json.loads(json.dumps(meta, default=json_serial))
        except Exception as e:
            print(f"[AUDIT] Failed to serialise meta: {e}")
            safe_meta = {"error": "Serialisation failed", "raw": str(meta)[:200]}

    log = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        meta=safe_meta
    )
    db.add(log)
    try:
        db.commit()
    except Exception as e:
        print(f"[AUDIT] Failed to save audit log: {e}")
        db.rollback()
