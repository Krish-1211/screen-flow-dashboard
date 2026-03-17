import boto3
import os
from botocore.config import Config

def get_b2_client():
    # Backblaze B2 S3 API works best with v4 signatures and specific addressing styles
    return boto3.client(
        "s3",
        endpoint_url=os.environ["B2_ENDPOINT"].rstrip("/"),
        aws_access_key_id=os.environ["B2_KEY_ID"],
        aws_secret_access_key=os.environ["B2_APPLICATION_KEY"],
        config=Config(
            signature_version="s3v4",
            s3={'addressing_style': 'virtual'}  # Better compatibility with B2 pre-signed URLs
        ),
        region_name=os.environ.get("B2_REGION", "us-east-005"),
    )

def upload_file(local_path: str, object_key: str, content_type: str) -> str:
    client = get_b2_client()
    bucket = os.environ["B2_BUCKET_NAME"]
    client.upload_file(
        local_path, bucket, object_key,
        ExtraArgs={"ContentType": content_type}
    )
    return object_key

def get_presigned_url(object_key: str, expires_in: int = 86400) -> str:
    client = get_b2_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": os.environ["B2_BUCKET_NAME"], "Key": object_key},
        ExpiresIn=expires_in,
    )
    return url

def delete_file(object_key: str):
    try:
        client = get_b2_client()
        client.delete_object(Bucket=os.environ["B2_BUCKET_NAME"], Key=object_key)
    except Exception:
        pass

def configure_bucket_cors():
    """Set CORS rules on the B2 bucket to allow browser playback."""
    try:
        client = get_b2_client()
        bucket = os.environ["B2_BUCKET_NAME"]
        client.put_bucket_cors(
            Bucket=bucket,
            CORSConfiguration={
                'CORSRules': [
                    {
                        'AllowedHeaders': ['*'],
                        'AllowedMethods': ['GET', 'HEAD'],
                        'AllowedOrigins': [
                            'https://screenflow-dashboard.onrender.com',
                            'http://localhost:3000',
                            'http://localhost:5173',
                            'http://localhost:8000',
                        ],
                        'ExposeHeaders': ['Content-Length', 'Content-Type', 'Range'],
                        'MaxAgeSeconds': 86400,
                    }
                ]
            }
        )
        print(f"CORS configuration updated for bucket: {bucket}")
    except Exception as e:
        print(f"CORS configuration warning: {e}")
