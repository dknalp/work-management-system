import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..database import get_session
from ..models import PasswordResetToken, User
from ..schemas import (
    AccessTokenResponse,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
)
from ..security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3051")


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.email == body.email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=body.email,
        name=body.name,
        hashed_password=hash_password(body.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == body.email)).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh_token(body: RefreshRequest, session: Session = Depends(get_session)):
    payload = decode_token(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return AccessTokenResponse(access_token=create_access_token(str(user.id)))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: LogoutRequest):
    # Tokens are stateless; client is responsible for discarding them.
    # A token blacklist can be added here if needed.
    return None


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(body: ForgotPasswordRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == body.email)).first()
    # Always return 200 to avoid user enumeration
    if not user:
        return {"message": "If that email is registered, a reset link has been sent."}

    token = secrets.token_hex(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    reset = PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at)
    session.add(reset)
    session.commit()

    reset_url = f"{FRONTEND_URL}/reset-password?token={token}"
    print(f"\n{'='*60}", flush=True)
    print(f"[MOCK MAIL] Password reset for: {user.email}", flush=True)
    print(f"Reset link: {reset_url}", flush=True)
    print(f"Expires in: 1 hour", flush=True)
    print(f"{'='*60}\n", flush=True)

    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(body: ResetPasswordRequest, session: Session = Depends(get_session)):
    reset = session.exec(
        select(PasswordResetToken).where(PasswordResetToken.token == body.token)
    ).first()

    now = datetime.now(timezone.utc)

    if not reset:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")

    if reset.used:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token already used")

    expires = reset.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if now > expires:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token has expired")

    user = session.get(User, reset.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found")

    user.hashed_password = hash_password(body.new_password)
    user.updated_at = datetime.now(timezone.utc)
    reset.used = True
    session.add(user)
    session.add(reset)
    session.commit()

    return {"message": "Password reset successfully"}