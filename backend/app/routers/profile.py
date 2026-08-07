"""User profile and account management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any

from app.database import get_db
from app.models import User
from app.routers.auth import get_current_user
from app.schemas import UserOut
from app.utils.security import verify_password, get_password_hash

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("/", response_model=UserOut)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get current user's profile."""
    return current_user


@router.put("/email")
def update_email(
    new_email: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Update user's email address."""
    if not new_email or "@" not in new_email:
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Check if email already in use
    existing_user = db.query(User).filter(User.email == new_email.lower()).first()
    if existing_user and existing_user.id != current_user.id:
        raise HTTPException(status_code=400, detail="Email already in use")
    
    current_user.email = new_email.lower()
    db.commit()
    db.refresh(current_user)
    
    return {"success": True, "message": "Email updated successfully", "user": current_user}


@router.post("/change-password")
def change_password(
    current_password: str,
    new_password: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Change user's password."""
    # Verify current password
    if not verify_password(current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Validate new password
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not any(c.isupper() for c in new_password) or not any(c.isdigit() for c in new_password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain uppercase letter and digit",
        )
    
    # Update password
    current_user.hashed_password = get_password_hash(new_password)
    db.commit()
    
    return {"success": True, "message": "Password changed successfully"}


@router.delete("/")
def delete_account(
    password: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Delete user's account (irreversible)."""
    # Verify password before deletion
    if not verify_password(password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Password is incorrect")
    
    # Delete user (cascade should handle related records)
    db.delete(current_user)
    db.commit()
    
    return {"success": True, "message": "Account deleted successfully"}
