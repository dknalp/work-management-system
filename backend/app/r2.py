"""Cloudflare R2 client utility.

All R2 operations go through this module. The client uses the S3-compatible
API with boto3. FastAPI routes call the async helpers which run boto3 in a
thread executor to avoid blocking the event loop.
"""

import asyncio
import os
from functools import lru_cache, partial
from typing import IO, Any

import boto3
from botocore.config import Config


@lru_cache(maxsize=1)
def get_r2_client() -> Any:
    """Return a configured boto3 S3 client pointing at R2.

    The client is created once and cached for the lifetime of the process.
    Re-reading env vars on every call is unnecessary and creates a new TCP
    connection pool each time. If env vars change, restart the process.

    Accepts both CLOUDFLARE_ACCOUNT_ID (documented in CLAUDE.md / .env.example)
    and the legacy R2_ACCOUNT_ID name so neither breaks.
    """
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID") or os.environ.get("R2_ACCOUNT_ID", "")
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ.get("R2_ACCESS_KEY_ID", ""),
        aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY", ""),
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def get_bucket() -> str:
    return os.environ.get("R2_BUCKET_NAME", "")


async def r2_upload_fileobj(file_obj: IO[bytes], key: str, content_type: str) -> None:
    """Upload a file-like object to R2 (runs in thread executor)."""
    client = get_r2_client()
    bucket = get_bucket()
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        partial(
            client.upload_fileobj,
            file_obj,
            bucket,
            key,
            ExtraArgs={"ContentType": content_type},
        ),
    )


async def r2_delete_object(key: str) -> None:
    """Delete an object from R2."""
    client = get_r2_client()
    bucket = get_bucket()
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        partial(client.delete_object, Bucket=bucket, Key=key),
    )


async def r2_copy_object(source_key: str, dest_key: str) -> None:
    """Copy an object within R2."""
    client = get_r2_client()
    bucket = get_bucket()
    loop = asyncio.get_running_loop()
    copy_source = {"Bucket": bucket, "Key": source_key}
    await loop.run_in_executor(
        None,
        partial(client.copy_object, CopySource=copy_source, Bucket=bucket, Key=dest_key),
    )


async def r2_get_object_bytes(key: str) -> bytes:
    """Download an object from R2 and return its bytes."""
    client = get_r2_client()
    bucket = get_bucket()
    loop = asyncio.get_running_loop()

    def _get() -> bytes:
        response = client.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()

    return await loop.run_in_executor(None, _get)


async def r2_generate_presigned_url(key: str, expires_in: int = 3600, disposition: str = "inline") -> str:
    """Generate a presigned GET URL for an R2 object."""
    client = get_r2_client()
    bucket = get_bucket()
    loop = asyncio.get_running_loop()

    def _sign() -> str:
        return client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": bucket,
                "Key": key,
                "ResponseContentDisposition": disposition,
            },
            ExpiresIn=expires_in,
        )

    return await loop.run_in_executor(None, _sign)


async def r2_delete_objects(keys: list[str]) -> None:
    """Batch-delete multiple objects from R2."""
    if not keys:
        return
    client = get_r2_client()
    bucket = get_bucket()
    loop = asyncio.get_running_loop()
    objects = [{"Key": k} for k in keys]
    await loop.run_in_executor(
        None,
        partial(client.delete_objects, Bucket=bucket, Delete={"Objects": objects}),
    )