import os
import warnings
from datetime import datetime, timedelta
from typing import Optional
import jwt

# Suppress passlib/bcrypt version detection warning (cosmetic only, not a bug)
warnings.filterwarnings("ignore", message=".*error reading bcrypt version.*")
warnings.filterwarnings("ignore", message=".*trapped.*error reading bcrypt.*")

from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer

# ── Security Configuration ────────────────────────────────────────────────────
# In production, generate a random key: python -c "import secrets; print(secrets.token_urlsafe(32))"
SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "change-this-in-production-use-a-random-32-char-string"
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
