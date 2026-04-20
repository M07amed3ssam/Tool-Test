"""
Admin User Seeder Script
Creates a default admin user in the database
"""
import os
import sys
from pathlib import Path

# Load environment variables from .env file
env_path = Path(__file__).resolve().parent / '.env'
if env_path.exists():
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip().strip('"\'')
else:
    print("⚠️  Warning: .env file not found")

from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext
from app.auth.models import User, UserRole
from app.db.database import engine

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# Create a session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Admin credentials - Change these before running in production!
ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"  # Change this password!

try:
    # Check if admin already exists
    existing_admin = db.query(User).filter(
        (User.email == ADMIN_EMAIL) | (User.username == ADMIN_USERNAME)
    ).first()
    
    if existing_admin:
        print(f"⚠️  Admin user already exists!")
        print(f"   Username: {existing_admin.username}")
        print(f"   Email: {existing_admin.email}")
        print(f"   Role: {existing_admin.role.value}")
    else:
        # Create admin user
        admin_user = User(
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            password_hash=get_password_hash(ADMIN_PASSWORD),
            role=UserRole.ADMIN
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print("✅ Admin user created successfully!")
        print(f"   ID: {admin_user.id}")
        print(f"   Username: {admin_user.username}")
        print(f"   Email: {admin_user.email}")
        print(f"   Role: {admin_user.role.value}")
        print(f"\n⚠️  Default password is '{ADMIN_PASSWORD}' - Please change it!")
        
except Exception as e:
    db.rollback()
    print(f"❌ Error creating admin user: {e}")
    
finally:
    db.close()
