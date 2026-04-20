from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List

from app.db.database import get_db
from app.auth import schemas, models, utils
from app.auth.models import UserRole

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
async def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if user with this email already exists
    db_user = utils.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if username already exists
    existing_username = db.query(models.User).filter(models.User.username == user.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create new user
    hashed_password = utils.get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        username=user.username,
        password_hash=hashed_password,
        role=UserRole.USER
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Authenticate user
    user = utils.get_user_by_email(db, email=form_data.username)  # OAuth2 uses username field for email
    if not user or not utils.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=utils.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = utils.create_access_token(
        data={"sub": str(user.id), "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(utils.get_current_user)):
    return current_user

# Admin routes
@router.get("/users", response_model=List[schemas.User])
async def get_all_users(current_user: models.User = Depends(utils.get_current_admin), db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    return users

@router.post("/users", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
async def create_user(user: schemas.UserCreate, current_user: models.User = Depends(utils.get_current_admin), db: Session = Depends(get_db)):
    """Create a new user (Admin only)"""
    # Check if user with this email already exists
    db_user = utils.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if username already exists
    existing_username = db.query(models.User).filter(models.User.username == user.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create new user
    hashed_password = utils.get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        username=user.username,
        password_hash=hashed_password,
        role=UserRole.USER  # Default role for new users
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.put("/users/{user_id}/role", response_model=schemas.User)
async def update_user_role(user_id: int, role_data: schemas.UserRoleUpdate, 
                          current_user: models.User = Depends(utils.get_current_admin), 
                          db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.role = role_data.role
    db.commit()
    db.refresh(user)
    return user

@router.delete("/users/{user_id}")
async def delete_user(user_id: int, 
                     current_user: models.User = Depends(utils.get_current_admin), 
                     db: Session = Depends(get_db)):
    """Delete a user (Admin only)"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admin from deleting themselves
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    db.delete(user)
    db.commit()
    return {"message": f"User {user.username} has been deleted successfully"}

@router.delete("/me")
async def delete_own_account(current_user: models.User = Depends(utils.get_current_user), 
                           db: Session = Depends(get_db)):
    """Delete current user's own account"""
    db.delete(current_user)
    db.commit()
    return {"message": "Your account has been deleted successfully"}

@router.put("/me/password")
async def update_password(password_data: schemas.PasswordUpdate, 
                       current_user: models.User = Depends(utils.get_current_user),
                       db: Session = Depends(get_db)):
    """Update current user's password"""
    # Verify current password
    if not utils.verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    # Update password
    current_user.password_hash = utils.get_password_hash(password_data.new_password)
    db.commit()
    db.refresh(current_user)
    return {"message": "Password updated successfully"}

# Custom login endpoint that accepts JSON instead of form data
@router.post("/login/json", response_model=schemas.Token)
async def login_json(user_data: schemas.UserLogin, db: Session = Depends(get_db)):
    # Authenticate user
    user = utils.get_user_by_email(db, email=user_data.email)
    if not user or not utils.verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=utils.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = utils.create_access_token(
        data={"sub": str(user.id), "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}