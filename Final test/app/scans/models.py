import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.auth.models import User
from app.db.database import Base


class ScanStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    CANCELLING = "cancelling"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    FAILED = "failed"


class ScanJob(Base):
    __tablename__ = "scan_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    scan_name = Column(String(255), nullable=False)
    target = Column(String(512), nullable=False)
    target_type = Column(String(32), nullable=True)
    scan_profile = Column(String(64), nullable=False, default="standard")
    planner_engine = Column(String(16), nullable=False, default="rules")
    orchestration_mode = Column(String(16), nullable=False, default="sequential")
    max_parallel = Column(Integer, nullable=False, default=1)
    retries = Column(Integer, nullable=False, default=2)
    backoff = Column(Integer, nullable=False, default=2)
    timeout = Column(Integer, nullable=False, default=900)
    max_steps = Column(Integer, nullable=False, default=0)
    only_tools = Column(JSON, nullable=True)
    authorization_ack = Column(Boolean, nullable=False, default=False)
    status = Column(Enum(ScanStatus), nullable=False, default=ScanStatus.QUEUED, index=True)
    progress = Column(Integer, nullable=False, default=0)
    artifacts_dir = Column(String(1024), nullable=True)
    error_message = Column(Text, nullable=True)
    scan_summary = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="scan_jobs")
    logs = relationship("ScanLog", back_populates="scan_job", cascade="all, delete-orphan")
    artifacts = relationship("ScanArtifact", back_populates="scan_job", cascade="all, delete-orphan")
    findings = relationship("ScanFinding", back_populates="scan_job", cascade="all, delete-orphan")


class ScanLog(Base):
    __tablename__ = "scan_logs"

    id = Column(Integer, primary_key=True, index=True)
    scan_job_id = Column(Integer, ForeignKey("scan_jobs.id"), nullable=False, index=True)
    step = Column(Integer, nullable=False, default=0)
    tool = Column(String(128), nullable=False, default="")
    command = Column(Text, nullable=False, default="")
    command_source = Column(String(16), nullable=False, default="static")
    primary_command = Column(Text, nullable=False, default="")
    fallback_used = Column(Boolean, nullable=False, default=False)
    mode = Column(String(16), nullable=False, default="sequential")
    batch = Column(Integer, nullable=False, default=1)
    status = Column(String(32), nullable=False, default="pending")
    attempts = Column(Integer, nullable=False, default=0)
    output_summary = Column(Text, nullable=True)
    stdout = Column(Text, nullable=True)
    stderr = Column(Text, nullable=True)
    errors = Column(Text, nullable=True)
    return_code = Column(Integer, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    scan_job = relationship("ScanJob", back_populates="logs")


class ScanArtifact(Base):
    __tablename__ = "scan_artifacts"

    id = Column(Integer, primary_key=True, index=True)
    scan_job_id = Column(Integer, ForeignKey("scan_jobs.id"), nullable=False, index=True)
    artifact_key = Column(String(128), nullable=False, index=True)
    artifact_type = Column(String(32), nullable=False, default="json")
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(1024), nullable=False)
    content_type = Column(String(128), nullable=False, default="application/octet-stream")
    size_bytes = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    scan_job = relationship("ScanJob", back_populates="artifacts")


class ScanFinding(Base):
    __tablename__ = "scan_findings"

    id = Column(Integer, primary_key=True, index=True)
    scan_job_id = Column(Integer, ForeignKey("scan_jobs.id"), nullable=False, index=True)
    finding_id = Column(String(64), nullable=False, index=True)
    asset = Column(String(512), nullable=False, default="unknown")
    source_tool = Column(String(128), nullable=False, default="unknown")
    category = Column(String(64), nullable=False, default="unknown")
    severity = Column(String(16), nullable=False, default="info", index=True)
    status = Column(String(32), nullable=False, default="new")
    evidence = Column(JSON, nullable=True)
    finding_timestamp = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    scan_job = relationship("ScanJob", back_populates="findings")


User.scan_jobs = relationship("ScanJob", back_populates="user", cascade="all, delete-orphan")
