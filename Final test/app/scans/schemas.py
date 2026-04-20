from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.scans.models import ScanStatus


class ScanCreate(BaseModel):
    scan_name: Optional[str] = Field(default=None, max_length=255)
    target: str = Field(..., min_length=1, max_length=512)
    scan_profile: str = Field(default="standard", max_length=64)
    planner_engine: str = Field(default="rules", pattern="^(rules|ai)$")
    orchestration_mode: str = Field(default="auto", pattern="^(auto|sequential|parallel)$")
    max_parallel: int = Field(default=0, ge=0, le=8)
    retries: int = Field(default=2, ge=0, le=5)
    backoff: int = Field(default=2, ge=1, le=60)
    timeout: int = Field(default=900, ge=30, le=7200)
    max_steps: int = Field(default=0, ge=0, le=1000)
    only_tools: List[str] = Field(default_factory=list)
    authorization_ack: bool = Field(default=False)


class ScanRetryRequest(BaseModel):
    authorization_ack: bool = Field(default=True)


class ScanJob(BaseModel):
    id: int
    user_id: int
    scan_name: str
    target: str
    target_type: Optional[str] = None
    scan_profile: str
    planner_engine: str
    orchestration_mode: str
    max_parallel: int
    retries: int
    backoff: int
    timeout: int
    max_steps: int
    only_tools: Optional[List[str]] = None
    authorization_ack: bool
    status: ScanStatus
    progress: int
    artifacts_dir: Optional[str] = None
    error_message: Optional[str] = None
    scan_summary: Optional[Dict[str, Any]] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ScanJobList(BaseModel):
    items: List[ScanJob]
    total: int
    page: int
    page_size: int
    total_pages: int


class ScanLog(BaseModel):
    id: int
    scan_job_id: int
    step: int
    tool: str
    command: str
    command_source: str
    primary_command: str
    fallback_used: bool
    mode: str
    batch: int
    status: str
    attempts: int
    output_summary: Optional[str] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    errors: Optional[str] = None
    return_code: Optional[int] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ScanLogList(BaseModel):
    items: List[ScanLog]
    total: int
    page: int
    page_size: int
    total_pages: int


class ScanArtifact(BaseModel):
    id: int
    scan_job_id: int
    artifact_key: str
    artifact_type: str
    file_name: str
    file_path: str
    content_type: str
    size_bytes: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ScanFinding(BaseModel):
    id: int
    scan_job_id: int
    finding_id: str
    asset: str
    source_tool: str
    category: str
    severity: str
    status: str
    evidence: Optional[Dict[str, Any]] = None
    finding_timestamp: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ScanFindingList(BaseModel):
    items: List[ScanFinding]
    total: int
    page: int
    page_size: int
    total_pages: int
