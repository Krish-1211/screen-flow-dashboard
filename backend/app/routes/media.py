import os
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.media import Media


MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", "media")).resolve()
VIDEOS_DIR = MEDIA_ROOT / "videos"
IMAGES_DIR = MEDIA_ROOT / "images"

for d in (VIDEOS_DIR, IMAGES_DIR):
    d.mkdir(parents=True, exist_ok=True)

router = APIRouter()


@router.get("/", response_model=List[dict])
def list_media(db: Session = Depends(get_db)):
    items = db.query(Media).order_by(Media.uploaded_at.desc()).all()
    return [
        {
            "id": m.id,
            "name": m.filename,
            "type": "video" if m.file_type.startswith("video") else "image",
            "url": m.url,
            "duration": m.duration,
            "uploaded_at": m.uploaded_at.isoformat(),
        }
        for m in items
    ]


@router.post("/upload", response_model=dict)
async def upload_media(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content_type = file.content_type or ""
    if not (content_type.startswith("image") or content_type.startswith("video")):
        raise HTTPException(status_code=400, detail="Unsupported media type")

    target_dir = VIDEOS_DIR if content_type.startswith("video") else IMAGES_DIR
    filename = f"{int(datetime.utcnow().timestamp())}_{file.filename}"
    file_path = target_dir / filename

    with file_path.open("wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)

    relative_url = f"/media/{'videos' if content_type.startswith('video') else 'images'}/{filename}"

    media = Media(
        filename=filename,
        file_type=content_type,
        url=relative_url,
        duration=None,
    )
    db.add(media)
    db.commit()
    db.refresh(media)

    return {
        "id": media.id,
        "name": media.filename,
        "type": "video" if media.file_type.startswith("video") else "image",
        "url": media.url,
        "duration": media.duration,
    }


@router.delete("/{media_id}", status_code=204)
def delete_media(media_id: int, db: Session = Depends(get_db)):
    media = db.query(Media).filter(Media.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    # remove file if exists
    abs_path = (MEDIA_ROOT / media.url.lstrip("/")).resolve()
    try:
        if abs_path.is_file():
            abs_path.unlink()
    except OSError:
        # ignore filesystem errors; we still remove db record
        pass

    db.delete(media)
    db.commit()


@router.get("/files/{kind}/{filename}")
def serve_media_file(kind: str, filename: str):
    if kind not in {"videos", "images"}:
        raise HTTPException(status_code=404, detail="Invalid media kind")
    base = VIDEOS_DIR if kind == "videos" else IMAGES_DIR
    path = (base / filename).resolve()
    if not path.is_file() or MEDIA_ROOT not in path.parents and path != MEDIA_ROOT:
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)

