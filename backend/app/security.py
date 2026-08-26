"""Security utilities for the work-management-system backend.

This module owns API key generation and verification.  JWT creation/decoding
has been removed — authentication tokens are now Firebase ID tokens verified
by ``firebase_auth.verify_firebase_token``.

Password hashing is no longer needed either; Firebase Authentication manages
passwords on the server side via ``firebase_admin.auth.update_user``.
"""

import hashlib
import hmac
import os
import secrets
from typing import Tuple


def generate_api_key() -> Tuple[str, str, str]:
    """Generate a new API key for a bot account.

    Returns a tuple of ``(full_key, key_prefix, key_hash)``.  Only the
    prefix and hash should be stored in the database; the full key is
    returned exactly once and must be shown to the user immediately.

    - ``full_key``   — the complete secret (e.g. ``wms_live_<64 hex chars>``)
    - ``key_prefix`` — first 16 characters; safe to expose in the UI
    - ``key_hash``   — HMAC-SHA256 hex digest of the full key; used for lookup
    """
    raw = secrets.token_hex(32)
    full_key = f"wms_live_{raw}"
    key_prefix = full_key[:16]
    key_hash = hash_api_key(full_key)
    return full_key, key_prefix, key_hash


def hash_api_key(full_key: str) -> str:
    """Return an HMAC-SHA256 hex digest of the API key.

    Keyed on the HMAC_SECRET environment variable. Using HMAC means an
    exfiltrated database alone is not sufficient to brute-force stored keys —
    the attacker also needs the server secret.

    Falls back to a fixed development string when the variable is unset so
    that local dev still works; always set HMAC_SECRET in production.
    """
    secret = os.getenv("HMAC_SECRET", "dev-hmac-secret-change-in-production")
    return hmac.new(secret.encode(), full_key.encode(), hashlib.sha256).hexdigest()
