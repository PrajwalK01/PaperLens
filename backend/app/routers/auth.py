import random
import re
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Any

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserOut, Token, VerifyOTPRequest, ResendOTPRequest
from app.utils.security import get_password_hash, verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, oauth2_scheme
from app.utils.email import send_otp_email
import jwt
from jwt.exceptions import InvalidTokenError
from app.utils.security import SECRET_KEY, ALGORITHM

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)

def _generate_and_send_otp(user: User, db: Session) -> None:
    otp = f"{random.randint(100000, 999999)}"
    user.otp = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    try:
        db.commit()
        db.refresh(user)
        send_otp_email(user.email, otp)
    except Exception as exc:
        db.rollback()
        logger.error("Failed to generate or send OTP for %s: %s", user.email, exc)


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is not verified",
        )
        
    return user

@router.post("/register", response_model=UserOut)
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> Any:
    """Register a new user account and send verification OTP."""
    # Check if email already exists
    user = db.query(User).filter(User.email == user_in.email.lower()).first()
    if user:
        if user.is_verified:
            raise HTTPException(
                status_code=400,
                detail="Email already registered. Use login instead.",
            )
        else:
            # User is registered but not verified. Update password and send a new OTP.
            hashed_password = get_password_hash(user_in.password)
            user.hashed_password = hashed_password
            if user_in.username:
                user.username = user_in.username.lower()
            
            otp = f"{random.randint(100000, 999999)}"
            user.otp = otp
            user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
            
            try:
                db.commit()
                db.refresh(user)
                send_otp_email(user.email, otp)
                return user
            except Exception as e:
                db.rollback()
                raise HTTPException(
                    status_code=500,
                    detail="Failed to update unverified user account. Please try again.",
                ) from e

    # Generate username if not provided
    username = user_in.username
    if not username:
        # derive from email prefix, keeping only alphanumeric/dashes/underscores
        email_prefix = user_in.email.split('@')[0]
        username = re.sub(r'[^a-zA-Z0-9_-]', '', email_prefix)
        if len(username) < 3:
            username = username + "user"
            
        # Ensure unique username
        base_username = username
        while db.query(User).filter(User.username == username.lower()).first() is not None:
            username = f"{base_username}{random.randint(100, 999)}"
    
    # Check if username already exists explicitly
    existing_user_username = db.query(User).filter(User.username == username.lower()).first()
    if existing_user_username:
        raise HTTPException(
            status_code=400,
            detail="Username already taken. Choose a different one.",
        )
    
    # Create new user
    hashed_password = get_password_hash(user_in.password)
    otp = f"{random.randint(100000, 999999)}"
    otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    user_db = User(
        email=user_in.email.lower(),
        username=username.lower(),
        hashed_password=hashed_password,
        is_verified=False,
        otp=otp,
        otp_expires_at=otp_expires_at,
    )
    
    # Make the first user an admin
    if db.query(User).count() == 0:
        user_db.is_admin = True

    try:
        db.add(user_db)
        db.commit()
        db.refresh(user_db)
        send_otp_email(user_db.email, otp)
        return user_db
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create user account. Please try again.",
        ) from e

@router.post("/login", response_model=Token)
def login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """Authenticate and return JWT access token."""
    if not form_data.username or not form_data.password:
        raise HTTPException(
            status_code=400,
            detail="Username/email and password required.",
        )
    
    # Allow logging in with either username or email
    user = db.query(User).filter(
        (User.username == form_data.username.lower()) | (User.email == form_data.username.lower())
    ).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid email/username or password.",
        )
        
    # Check if user is verified
    if not user.is_verified:
        _generate_and_send_otp(user, db)
        raise HTTPException(
            status_code=400,
            detail="unverified",
        )
    
    try:
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username, "user_id": user.id}, 
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Token generation failed. Please try again.",
        ) from e

@router.post("/verify-otp", response_model=Token)
def verify_otp(data: VerifyOTPRequest, db: Session = Depends(get_db)) -> Any:
    """Verify OTP code and activate user, returning JWT access token."""
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )
        
    if user.is_verified:
        # If already verified, log them in directly
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username, "user_id": user.id},
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
        
    if not user.otp or user.otp != data.otp.strip():
        raise HTTPException(
            status_code=400,
            detail="Invalid verification code.",
        )
        
    if user.otp_expires_at and datetime.utcnow() > user.otp_expires_at:
        raise HTTPException(
            status_code=400,
            detail="Verification code has expired. Please request a new one.",
        )
        
    # Activate user
    user.is_verified = True
    user.otp = None
    user.otp_expires_at = None
    
    try:
        db.commit()
        db.refresh(user)
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username, "user_id": user.id},
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to verify account. Please try again.",
        ) from e

@router.post("/resend-otp")
def resend_otp(data: ResendOTPRequest, db: Session = Depends(get_db)) -> Any:
    """Regenerate and resend OTP verification code."""
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )
        
    if user.is_verified:
        raise HTTPException(
            status_code=400,
            detail="Account already verified.",
        )
        
    otp = f"{random.randint(100000, 999999)}"
    user.otp = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    try:
        db.commit()
        send_otp_email(user.email, otp)
        return {"status": "success", "message": "Verification code resent."}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to resend code. Please try again.",
        ) from e

@router.get("/me", response_model=UserOut)
def read_users_me(current_user: User = Depends(get_current_user)) -> Any:
    return current_user
