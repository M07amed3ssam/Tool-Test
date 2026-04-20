from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base
from app.auth.models import User

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    report_name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=False)
    final_file = Column(String(255), nullable=False)
    full_file = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship with User model
    user = relationship("User", back_populates="reports")

# Add relationship to User model
User.reports = relationship("Report", back_populates="user", cascade="all, delete-orphan")