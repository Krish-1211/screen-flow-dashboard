import os
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Body
from fastapi.responses import FileResponse
from pydantic import BaseModel
import subprocess
import json
from sqlalchemy.orm import Session
import re
import uuid

from ..database import get_db
from ..models.media import Media
from ..auth import get_current_user
from ..services.audit import write_audit_log
from ..services import storage
from ..services.storage import get_proxy_url
import tempfile


MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", "media")).resolve()
VIDEOS_DIR = MEDIA_ROOT / "videos"
IMAGES_DIR = MEDIA_ROOT / "images"

for d in (VIDEOS_DIR, IMAGES_DIR):
    d.mkdir(parents=True, exist_ok=True)


class YouTubePayload(BaseModel):
    url: str


router = APIRouter()
public_router = APIRouter()


@public_router.get("/proxy/{filename:path}", include_in_schema=False)
async def proxy_media(filename: str):
    """
    Public endpoint that proxies media files from Supabase.
    No auth required — used by the player to fetch media.
    This solves CORS issues since the browser talks to our
    own API instead of Supabase directly.
    """
    import httpx
    from fastapi.responses import StreamingResponse
    from ..services.storage import get_presigned_url

    # Strip any leading media/ prefix to avoid double prefix
    clean_filename = filename.lstrip("/")
    if clean_filename.startswith("media/"):
        object_key = clean_filename
    else:
        object_key = f"media/{clean_filename}"

    print(f"[PROXY] Requested filename: {filename}")
    print(f"[PROXY] Using object key: {object_key}")

    try:
        url = get_presigned_url(object_key)
        print(f"[PROXY] Pre-signed URL generated: {url[:80]}...")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)

        print(f"[PROXY] Supabase response status: {response.status_code}")

        if response.status_code == 200:
            ext = filename.lower().split('.')[-1]
            content_type_map = {
                'mp4': 'video/mp4',
                'mov': 'video/quicktime',
                'avi': 'video/x-msvideo',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'webp': 'image/webp',
            }
            content_type = content_type_map.get(ext, 'application/octet-stream')

            return StreamingResponse(
                iter([response.content]),
                media_type=content_type,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=86400",
                    "Content-Length": str(len(response.content)),
                }
            )
        
        print(f"[PROXY] Supabase error body: {response.text[:200]}")

    except Exception as e:
        print(f"[PROXY] Exception: {type(e).__name__}: {e}")

    # Fallback for ANY failure (status != 200 or Exception)
    print(f"[PROXY] Triggering fallback demo media for {filename}")
    from fastapi.responses import RedirectResponse
    ext = filename.lower().split('.')[-1]
    is_video = ext in ['mp4', 'mov', 'avi']
    
    fallback_url = (
        "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" 
        if is_video 
        else "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1920&auto=format&fit=crop"
    )
    return RedirectResponse(url=fallback_url, status_code=302)



def sanitise_filename(filename: str) -> str:
    # Extract only the base name, strip any directory components
    name = os.path.basename(filename)
    # Keep only alphanumeric, dot, dash, underscore
    name = re.sub(r"[^\w.\-]", "_", name)
    # Collapse multiple dots to prevent extension spoofing like file.php.jpg
    name = re.sub(r"\.{2,}", ".", name)
    # If the result is empty or only dots/underscores, generate a safe name
    if not name or name.strip("._") == "":
        name = str(uuid.uuid4())
    # Enforce a max length
    if len(name) > 200:
        ext = os.path.splitext(name)[1]
        name = str(uuid.uuid4()) + ext
    return name


@router.get("/", response_model=List[dict])
def list_media(db: Session = Depends(get_db)):
    items = db.query(Media).order_by(Media.created_at.desc()).all()
    return [
        {
            "id": str(m.id),
            "name": m.name,
            "type": "video" if m.type.startswith("video") else "image",
            "url": get_proxy_url(m.name) if m.name else None,
            "duration": float(m.duration) if m.duration else None,
            "uploaded_at": m.created_at.isoformat() + "Z",
        }
        for m in items
    ]


@router.post("/upload", response_model=dict)
async def upload_media(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    content_type = file.content_type or ""
    if not (content_type.startswith("image") or content_type.startswith("video")):
        raise HTTPException(status_code=400, detail="Unsupported media type")

    safe_name = sanitise_filename(file.filename)
    file_type = "video" if content_type.startswith("video") else "image"
    
    # Save to a temporary file for processing
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(safe_name)[1]) as tmp:
        tmp_path = tmp.name
        while chunk := await file.read(1024 * 1024):
            tmp.write(chunk)

    try:
        # Construct the Supabase object key
        timestamp = int(datetime.utcnow().timestamp())
        unique_name = f"{timestamp}_{safe_name}"
        object_key = f"media/{unique_name}"

        # Upload to Supabase
        object_key = storage.upload_file(tmp_path, object_key, content_type)

        media = Media(
            name=object_key,
            type=content_type,
            url="", # No longer storing static URL in DB
            duration=None,
        )
        db.add(media)
        db.commit()
        db.refresh(media)
        
        write_audit_log(db, current_user['id'], "upload", "media", str(media.id), meta={"name": media.name})

        return {
            "id": str(media.id),
            "name": media.name,
            "type": file_type,
            "url": get_proxy_url(media.name),
            "duration": media.duration,
        }
    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/youtube", response_model=dict)
async def add_youtube_media(
    payload: YouTubePayload,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    url = payload.url
    
    # Use yt-dlp to get video info
    try:
        # Get info first
        cmd_info = [
            "yt-dlp",
            "--print", "%(title)s|%(ext)s|%(duration)s",
            "--no-playlist",
            url
        ]
        result = subprocess.run(cmd_info, capture_output=True, text=True, check=True)
        parts = result.stdout.strip().split("|")
        if len(parts) < 3:
            raise HTTPException(status_code=400, detail="Could not retrieve video info")
        
        title, ext, duration_str = parts
        duration = float(duration_str) if duration_str else None
        
        # Download to a temporary location
        ts = int(datetime.utcnow().timestamp())
        base_name = f"{ts}_yt"
        
        with tempfile.TemporaryDirectory() as tmpdir:
            output_template = os.path.join(tmpdir, f"{base_name}.%(ext)s")
            
            subprocess.run([
                "yt-dlp",
                "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
                "-o", output_template,
                "--no-playlist",
                url
            ], check=True)
            
            # Find the file in tmpdir
            downloaded_files = list(Path(tmpdir).glob(f"{base_name}.*"))
            if not downloaded_files:
                raise HTTPException(status_code=500, detail="Download failed")
            
            actual_file = downloaded_files[0]
            filename = actual_file.name
            content_type = "video/mp4" 
            
            # Upload to Supabase
            object_key = f"media/{filename}"
            stored_key = storage.upload_file(str(actual_file), object_key, content_type)
            
            media = Media(
                name=stored_key,
                type=content_type,
                url="", # No longer storing static URL in DB
                duration=int(duration) if duration else None,
            )
            db.add(media)
            db.commit()
            db.refresh(media)
            
            write_audit_log(db, current_user['id'], "youtube_download", "media", str(media.id), meta={"url": url, "name": media.name})
            
            return {
                "id": str(media.id),
                "name": media.name,
                "type": "video",
                "url": get_proxy_url(media.name),
                "duration": media.duration,
            }
        
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=400, detail=f"yt-dlp error: {e.stderr}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{media_id}", status_code=204)
def delete_media(
    media_id: str, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    media = db.query(Media).filter(Media.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    # Delete from Supabase
    storage.delete_file(media.name)

    db.delete(media)
    db.commit()
    
    write_audit_log(db, current_user['id'], "delete", "media", str(media_id))


# Removed serve_media_file - media is now served via R2 public URLs.

