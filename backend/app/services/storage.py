import boto3
import os
from botocore.config import Config

def get_b2_client():
    return boto3.client(
        "s3",
        endpoint_url=os.environ["B2_ENDPOINT"],
        aws_access_key_id=os.environ["B2_KEY_ID"],
        aws_secret_access_key=os.environ["B2_APPLICATION_KEY"],
        config=Config(signature_version="s3v4"),
        region_name="us-east-005",
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
