"""Firebase Admin SDK initializer and Firestore dependency.

Initialization strategy (checked in order):
1. FIREBASE_SERVICE_ACCOUNT_JSON env var is a file path → load from file
2. FIREBASE_SERVICE_ACCOUNT_JSON env var is a JSON string → parse inline
3. Neither set → fall back to Application Default Credentials (ADC),
   which works inside Google Cloud environments automatically.

Usage:
    from app.firebase import get_db, initialize_firebase

    initialize_firebase()          # call once at startup
    db = get_db()                  # FastAPI dependency or direct call
"""

import json
import logging
import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

logger = logging.getLogger(__name__)

# Cached Firestore client — created once and reused for all requests
_db: firestore.Client | None = None


def initialize_firebase() -> None:
    """Initialize the Firebase Admin SDK exactly once.

    Safe to call multiple times; subsequent calls are no-ops.

    Raises
    ------
    RuntimeError
        If initialization fails for any reason (bad credentials, missing env
        var, malformed JSON, etc.).  The error message includes a hint about
        which credential path was attempted.
    """
    if firebase_admin._apps:
        logger.debug("Firebase already initialized — skipping")
        return

    raw = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()

    if not raw:
        # Fall back to Application Default Credentials
        logger.info(
            "FIREBASE_SERVICE_ACCOUNT_JSON not set — "
            "using Application Default Credentials (ADC)"
        )
        try:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized via ADC")
            return
        except Exception as exc:
            raise RuntimeError(
                "Firebase initialization failed with ADC. "
                "Set FIREBASE_SERVICE_ACCOUNT_JSON to a key file path or JSON string. "
                f"Underlying error: {exc}"
            ) from exc

    # Path to a JSON key file
    if not raw.startswith("{"):
        path = Path(raw)
        logger.info("Loading Firebase credentials from file: %s", path)
        if not path.exists():
            raise RuntimeError(
                f"FIREBASE_SERVICE_ACCOUNT_JSON points to a file that does not exist: {path}"
            )
        try:
            cred = credentials.Certificate(str(path))
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized from key file: %s", path)
            return
        except Exception as exc:
            raise RuntimeError(
                f"Firebase initialization failed loading key file '{path}': {exc}"
            ) from exc

    # Inline JSON string
    logger.info("Loading Firebase credentials from inline JSON string")
    try:
        service_account_info = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON. "
            f"Parse error: {exc}"
        ) from exc

    # Repair common escaping issue: double-escaped newlines \\n → \n
    if "private_key" in service_account_info:
        pk = service_account_info["private_key"]
        if "\\n" in pk and "\n" not in pk:
            logger.debug("Repairing double-escaped newlines in private_key")
            service_account_info["private_key"] = pk.replace("\\n", "\n")

    try:
        cred = credentials.Certificate(service_account_info)
        firebase_admin.initialize_app(cred)
        logger.info(
            "Firebase initialized from inline JSON for project: %s",
            service_account_info.get("project_id", "unknown"),
        )
    except Exception as exc:
        raise RuntimeError(
            f"Firebase initialization failed from inline JSON: {exc}"
        ) from exc


def get_db() -> firestore.Client:
    """Return the shared Firestore client, initializing it on first call.

    This function is used both as a FastAPI dependency and as a direct
    call from startup seed functions.

    Returns
    -------
    firestore.Client
        The shared Firestore client instance.
    """
    global _db
    if _db is None:
        logger.debug("Creating Firestore client")
        _db = firestore.client()
        logger.debug("Firestore client ready")
    return _db