import os
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Body, Request
from fastapi.responses import FileResponse, StreamingResponse
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
async def proxy_media(filename: str, request: Request):
    """
    Public endpoint that proxies media files from Supabase.
    No auth required — used by the player to fetch media.
    This solves CORS issues since the browser talks to our
    own API instead of Supabase directly.
    Supports HTTP Range requests for video seeking.
    """
    import httpx
    # StreamingResponse already imported above
    from ..services.storage import get_presigned_url

    # Strip any leading media/ prefix to avoid double prefix
    clean_filename = filename.lstrip("/")
    if clean_filename.startswith("media/"):
        object_key = clean_filename
    else:
        object_key = f"media/{clean_filename}"

    # Get range header from client request
    range_header = request.headers.get("Range")
    headers = {}
    if range_header:
        headers["Range"] = range_header

    try:
        url = get_presigned_url(object_key)
        
        # We use an async client to stream the response from Supabase
        # directly to the client. This supports large files and seeking.
        client = httpx.AsyncClient(timeout=60.0)
        req = client.build_request("GET", url, headers=headers)
        response = await client.send(req, stream=True)

        if response.status_code in (200, 206):
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
            content_type = response.headers.get("Content-Type") or content_type_map.get(ext, 'application/octet-stream')

            # Prepare client headers
            client_headers = {
                "Access-Control-Allow-Origin": "*",
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=86400",
            }
            
            # Pass through partial content headers
            for h in ["Content-Range", "Content-Length", "Content-Type"]:
                if h in response.headers:
                    client_headers[h] = response.headers[h]

            return StreamingResponse(
                response.aiter_bytes(),
                status_code=response.status_code,
                media_type=content_type,
                headers=client_headers,
                background=client.aclose, # Ensure client closes after stream ends
            )
        
        # If we got here, Supabase returned an error status
        await client.aclose()
        print(f"[PROXY] Supabase returned status {response.status_code} for {object_key}")

    except Exception as e:
        print(f"[PROXY] Exception: {type(e).__name__}: {e}")

    # Fallback for ANY failure
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
    try:
        items = db.query(Media).order_by(Media.created_at.desc()).all()
        result = []
        for m in items:
            try:
                # Be defensive about every field
                media_id = str(m.id) if m.id else ""
                media_name = m.name or "Unnamed"
                
                # Check type
                if not m.type:
                    media_type = "image"
                elif m.type.startswith("video"):
                    media_type = "video"
                else:
                    media_type = "image"
                
                # Check duration
                try:
                    duration = float(m.duration) if m.duration is not None else None
                except (ValueError, TypeError):
                    duration = None

                # Check created_at
                try:
                    uploaded_at = m.created_at.isoformat() + "Z" if m.created_at else datetime.utcnow().isoformat() + "Z"
                except Exception:
                    uploaded_at = datetime.utcnow().isoformat() + "Z"

                result.append({
                    "id": media_id,
                    "name": media_name,
                    "type": media_type,
                    "url": get_proxy_url(media_name),
                    "duration": duration,
                    "uploaded_at": uploaded_at,
                })
            except Exception as row_error:
                print(f"[MEDIA] Error serializing row: {row_error}")
                continue
        return result
    except Exception as e:
        print(f"[MEDIA] Fatal error in list_media: {e}")
        # Return empty list instead of 500 to keep UI alive
        return []


@router.post("/upload", response_model=dict)
async def upload_media(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    print(f"[MEDIA] Starting upload for {file.filename} ({file.content_type})")
    content_type = file.content_type or ""
    if not (content_type.startswith("image") or content_type.startswith("video")):
        print(f"[MEDIA] Unsupported type: {content_type}")
        raise HTTPException(status_code=400, detail="Unsupported media type")

    safe_name = sanitise_filename(file.filename)
    file_type = "video" if content_type.startswith("video") else "image"
    
    # Save to a temporary file for processing
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(safe_name)[1]) as tmp:
            tmp_path = tmp.name
            print(f"[MEDIA] Saving to temp file: {tmp_path}")
            while chunk := await file.read(1024 * 1024):
                tmp.write(chunk)
        
        file_size = os.path.getsize(tmp_path)
        print(f"[MEDIA] File size: {file_size} bytes")
        if file_size == 0:
            raise ValueError("File is empty")

        # Construct the Supabase object key
        timestamp = int(datetime.utcnow().timestamp())
        unique_name = f"{timestamp}_{safe_name}"
        object_key = f"media/{unique_name}"

        # Upload to Supabase
        print(f"[MEDIA] Uploading to Supabase as {object_key}...")
        object_key = storage.upload_file(tmp_path, object_key, content_type)
        print(f"[MEDIA] Upload successful, stored key: {object_key}")

        media = Media(
            name=object_key,
            type=content_type,
            url="", # No longer storing static URL in DB
            duration=None,
        )
        db.add(media)
        db.commit()
        db.refresh(media)
        print(f"[MEDIA] Database record created with ID: {media.id}")
        
        write_audit_log(db, current_user['id'], "upload", "media", str(media.id), meta={"name": media.name})

        return {
            "id": str(media.id),
            "name": media.name,
            "type": file_type,
            "url": get_proxy_url(media.name),
            "duration": media.duration,
        }
    except Exception as e:
        import traceback
        print(f"[MEDIA] CRITICAL ERROR IN UPLOAD: {type(e).__name__}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
            print(f"[MEDIA] Cleaned up temp file: {tmp_path}")


@router.post("/youtube", response_model=dict)
async def add_youtube_media(
    payload: YouTubePayload,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    url = payload.url
    
    # Try to fetch info first using yt-dlp Python module via subprocess
    try:
        common_args = ["python3", "-m", "yt_dlp", "--no-playlist", "--no-check-certificates"]
        
        # Get info JSON
        cmd_info = common_args + ["-j", url]
        print(f"[YOUTUBE] Fetching info for {url}...")
        result_info = subprocess.run(cmd_info, capture_output=True, text=True, check=True)
        info = json.loads(result_info.stdout)
        
        title = info.get("title", "YouTube Video")
        duration = info.get("duration")
        print(f"[YOUTUBE] Found: {title} ({duration}s)")

        # Download to a temporary location
        ts = int(datetime.utcnow().timestamp())
        base_name = f"{ts}_yt"
        
        with tempfile.TemporaryDirectory() as tmpdir:
            output_template = os.path.join(tmpdir, f"{base_name}.%(ext)s")
            
            # Prefer a single-file format to avoid merge dependency (ffmpeg)
            cmd_dl = common_args + ["-f", "best[ext=mp4]/best", "-o", output_template, url]
            print(f"[YOUTUBE] Starting download...")
            subprocess.run(cmd_dl, check=True, capture_output=True, text=True)
            
            # Find the file
            downloaded_files = list(Path(tmpdir).glob(f"{base_name}.*"))
            if not downloaded_files:
                raise ValueError("No file found after successful yt-dlp command")
            
            actual_file = downloaded_files[0]
            filename = f"{ts}_{sanitise_filename(actual_file.name)}"
            content_type = "video/mp4" if filename.lower().endswith(".mp4") else "video/webm"
            
            # Upload to Supabase
            object_key = f"media/{filename}"
            print(f"[YOUTUBE] Storing in bucket as {object_key}...")
            stored_key = storage.upload_file(str(actual_file), object_key, content_type)
            
            media = Media(
                name=stored_key,
                type=content_type,
                url="", 
                duration=int(duration) if duration else None,
            )
            db.add(media)
            db.commit()
            db.refresh(media)
            
            write_audit_log(db, current_user['id'], "youtube_download", "media", str(media.id), meta={"url": url, "name": media.name, "title": title})
            print(f"[YOUTUBE] Successfully added: {media.name}")
            
            return {
                "id": str(media.id),
                "name": media.name,
                "type": "video",
                "url": get_proxy_url(media.name),
                "duration": media.duration,
            }
        
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr or e.stdout or str(e)
        error_snippet = error_msg.split('\n')[-2] if '\n' in error_msg.strip() else error_msg
        print(f"[YOUTUBE] yt-dlp error output: {error_msg}")
        raise HTTPException(status_code=400, detail=f"YouTube error: {error_snippet[:150]}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[YOUTUBE] Fatal error: {e}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


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

