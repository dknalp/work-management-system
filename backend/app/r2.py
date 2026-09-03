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
    """Download an object from R2 and return its bytes.

    Use r2_iter_object for large files — this loads the full content into RAM.
    """
    client = get_r2_client()
    bucket = get_bucket()
    loop = asyncio.get_running_loop()

    def _get() -> bytes:
        response = client.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()

    return await loop.run_in_executor(None, _get)


def r2_iter_object(key: str, chunk_size: int = 1024 * 1024):
    """Yield raw bytes chunks from R2 without buffering the full object.

    This is a synchronous generator intended to be passed to
    ``fastapi.responses.StreamingResponse`` — FastAPI iterates it in a thread
    executor automatically when used as the response body.

    Args:
        key: R2 object key.
        chunk_size: Bytes per chunk (default 1 MiB).

    Yields:
        ``bytes`` chunks until the object is exhausted.
    """
    client = get_r2_client()
    bucket = get_bucket()
    response = client.get_object(Bucket=bucket, Key=key)
    body = response["Body"]
    while True:
        chunk = body.read(chunk_size)
        if not chunk:
            break
        yield chunk


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

# ---------------------------------------------------------------------------
# Multipart upload helpers (used by chunked upload router)
# ---------------------------------------------------------------------------

async def r2_create_multipart_upload(key: str, content_type: str) -> str:
    """Initiate an S3 multipart upload and return the upload ID."""
    client = get_r2_client()
    bucket = get_bucket()
    loop = asyncio.get_running_loop()

    def _create() -> str:
        resp = client.create_multipart_upload(
            Bucket=bucket,
            Key=key,
            ContentType=content_type,
        )
        return resp["UploadId"]

    return await loop.run_in_executor(None, _create)


async def r2_upload_part(key: str, upload_id: str, part_number: int, data: bytes) -> str:
    """Upload one part of a multipart upload and return the ETag.

    Args:
        key: R2 object key.
        upload_id: The multipart upload ID from r2_create_multipart_upload.
        part_number: 1-based part index (S3 requires 1–10000).
        data: Raw bytes for this part (min 5 MiB except for the last part).

    Returns:
        ETag string (needed to complete the upload).
    """
    client = get_r2_client()
    bucket = get_bucket()
    loop = asyncio.get_running_loop()

    def _upload() -> str:
        resp = client.upload_part(
            Bucket=bucket,
            Key=key,
            UploadId=upload_id,
            PartNumber=part_number,
            Body=data,
        )
        return resp["ETag"]

    return await loop.run_in_executor(None, _upload)


async def r2_complete_multipart_upload(
    key: str,
    upload_id: str,
    parts: list[dict],
) -> None:
    """Complete a multipart upload by assembling all parts.

    Args:
        key: R2 object key.
        upload_id: The multipart upload ID.
        parts: List of {"PartNumber": int, "ETag": str} dicts, sorted ascending.
    """
    client = get_r2_client()
    bucket = get_bucket()
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        partial(
            client.complete_multipart_upload,
            Bucket=bucket,
            Key=key,
            UploadId=upload_id,
            MultipartUpload={"Parts": parts},
        ),
    )


async def r2_abort_multipart_upload(key: str, upload_id: str) -> None:
    """Abort a multipart upload and free all uploaded parts in R2.

    Always call this when a chunked upload is cancelled or permanently fails —
    R2 charges for storage used by incomplete multipart uploads until aborted.
    """
    client = get_r2_client()
    bucket = get_bucket()
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        partial(
            client.abort_multipart_upload,
            Bucket=bucket,
            Key=key,
            UploadId=upload_id,
        ),
    )


def r2_presign_put(key: str, content_type: str, expires: int = 3600) -> str:
    """Generate a presigned PUT URL for direct browser-to-R2 upload.

    The browser PUTs the file bytes directly to this URL — the backend never
    touches the file data. URL is valid for `expires` seconds (default 1 hour).
    """
    client = get_r2_client()
    bucket = get_bucket()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": bucket,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires,
    )


def r2_presign_multipart_part(
    key: str,
    upload_id: str,
    part_number: int,
    expires: int = 3600,
) -> str:
    """Generate a presigned PUT URL for one part of a multipart upload.

    Part numbers are 1-indexed (R2/S3 requirement).
    URL is valid for `expires` seconds (default 1 hour).
    """
    client = get_r2_client()
    bucket = get_bucket()
    return client.generate_presigned_url(
        "upload_part",
        Params={
            "Bucket": bucket,
            "Key": key,
            "UploadId": upload_id,
            "PartNumber": part_number,
        },
        ExpiresIn=expires,
    )
