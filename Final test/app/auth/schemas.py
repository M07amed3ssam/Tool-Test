from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from app.auth.models import UserRole

class UserBase(BaseModel):
    email: EmailStr
    username: str

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None
    role: Optional[UserRole] = None

class UserRoleUpdate(BaseModel):
    role: UserRole

class User(UserBase):
    id: int
    role: UserRole
    created_at: datetime

    model_config = {
        "from_attributes": True
    }