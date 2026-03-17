import os
from supabase import create_client, Client

# Supabase Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET_NAME", "media")

# Initialize client only if keys are present
supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def upload_file(local_path: str, object_key: str, content_type: str) -> str:
    """Uploads a file to Supabase Storage."""
    if not supabase:
        raise Exception("Supabase client not initialized")
    
    # Strip any leading 'media/' if the bucket is already called 'media' 
    # BUT keep it if the user wants a folder structure within the bucket.
    # In the previous B2 code, object_key was f"media/{unique_name}"
    
    with open(local_path, "rb") as f:
        # opts = {"content-type": content_type} # Supabase storage3 uses file_options
        try:
            # Overwrite if exists to avoid failures during testing
            supabase.storage.from_(SUPABASE_BUCKET).upload(
                path=object_key,
                file=f,
                file_options={"content-type": content_type, "x-upsert": "true"}
            )
        except Exception as e:
            # If upload fails, log it and re-raise or handle
            print(f"[STORAGE] Upload failed: {e}")
            raise e
            
    return object_key

def get_presigned_url(object_key: str, expires_in: int = 86400) -> str:
    """Generates a signed URL for a Supabase object."""
    if not supabase:
        return ""
    
    try:
        # Supabase returns a dictionary with 'signedURL'
        res = supabase.storage.from_(SUPABASE_BUCKET).create_signed_url(
            path=object_key,
            expires_in=expires_in
        )
        if isinstance(res, dict) and 'signedURL' in res:
            return res['signedURL']
        # Depending on SDK version it might return a string or dict
        return str(res)
    except Exception as e:
        print(f"[STORAGE] Signed URL generation failed: {e}")
        return ""

def get_proxy_url(filename: str) -> str:
    """Returns the backend proxy URL for a media file."""
    base_url = os.environ.get("API_BASE_URL", "").rstrip("/")
    # filename in DB is stored as the full object key (e.g. 'media/123_video.mp4')
    # The proxy endpoint expects the path after /media/proxy/
    # We strip 'media/' prefix if it's there because the proxy adds it back or handles it.
    clean_filename = filename.replace("media/", "")
    return f"{base_url}/media/proxy/{clean_filename}"

def delete_file(object_key: str):
    """Deletes a file from Supabase Storage."""
    if not supabase:
        return
    try:
        supabase.storage.from_(SUPABASE_BUCKET).remove([object_key])
    except Exception as e:
        print(f"[STORAGE] Delete failed: {e}")
        pass

def configure_bucket_cors():
    """Placeholder for Supabase CORS configuration."""
    # Supabase CORS is typically configured in the dashboard under Storage > Policies
    # or by default allows all origins for public buckets.
    pass
