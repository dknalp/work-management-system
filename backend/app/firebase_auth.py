"""Firebase Authentication helpers for token verification.

This module provides a single public function, ``verify_firebase_token``,
which the ``deps.py`` authentication layer calls to validate inbound Bearer
tokens.  It wraps the Firebase Admin SDK so the rest of the application has
no direct dependency on the SDK's auth namespace.
"""

from fastapi import HTTPException, status
from firebase_admin import auth


def verify_firebase_token(id_token: str) -> str:
    """Verify a Firebase ID token and return the Firebase UID.

    Parameters
    ----------
    id_token:
        The raw ID token string from the ``Authorization: Bearer <token>``
        header.

    Returns
    -------
    str
        The Firebase UID (``uid`` field from the decoded token).

    Raises
    ------
    HTTPException(401)
        If the token is missing, expired, revoked, or otherwise invalid.
    """
    try:
        decoded = auth.verify_id_token(id_token, check_revoked=True)
        return decoded["uid"]
    except auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please log in again.",
        )
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
        )
    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        )