from math import ceil
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path as ApiPath, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth.models import User, UserRole
from app.auth.utils import get_current_user
from app.db.database import get_db
from app.recon.input.classifier import classify_and_validate
from app.scans import schemas
from app.scans.models import ScanArtifact, ScanFinding, ScanJob, ScanLog, ScanStatus
from app.scans.runner import scan_execution_manager

router = APIRouter(prefix="/scans", tags=["Scans"])


def _parse_status_filter(raw_status: Optional[str]) -> Optional[ScanStatus]:
    if not raw_status:
        return None

    value = raw_status.strip().lower()
    for item in ScanStatus:
        if item.value == value:
            return item

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Invalid status filter: {raw_status}",
    )


def _get_scan_job_or_404(scan_id: int, db: Session) -> ScanJob:
    scan_job = db.query(ScanJob).filter(ScanJob.id == scan_id).first()
    if not scan_job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan job not found")
    return scan_job


def _ensure_scan_access(scan_job: ScanJob, current_user: User) -> None:
    if current_user.role == UserRole.ADMIN:
        return
    if scan_job.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this scan job")


def _reconcile_stale_cancelling(scan_job: ScanJob) -> bool:
    if scan_job.status != ScanStatus.CANCELLING:
        return False

    if scan_execution_manager.is_running(scan_job.id):
        return False

    scan_job.status = ScanStatus.CANCELLED
    scan_job.finished_at = scan_job.finished_at or datetime.now(timezone.utc)
    if not scan_job.error_message:
        scan_job.error_message = "Scan cancelled"
    return True


@router.post("", response_model=schemas.ScanJob, status_code=status.HTTP_201_CREATED)
async def create_scan_job(
    payload: schemas.ScanCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.authorization_ack:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authorization acknowledgement is required for defensive scanning workflows",
        )

    scan_name = payload.scan_name.strip() if payload.scan_name else payload.target.strip()
    if not scan_name:
        scan_name = payload.target.strip()

    validation = classify_and_validate(payload.target.strip())
    if not validation.valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation.errors,
        )

    scan_job = ScanJob(
        user_id=current_user.id,
        scan_name=scan_name,
        target=validation.normalized_target,
        target_type=validation.target_type,
        scan_profile=payload.scan_profile,
        planner_engine=payload.planner_engine,
        orchestration_mode=payload.orchestration_mode,
        max_parallel=payload.max_parallel,
        retries=payload.retries,
        backoff=payload.backoff,
        timeout=payload.timeout,
        max_steps=payload.max_steps,
        only_tools=payload.only_tools,
        authorization_ack=payload.authorization_ack,
        status=ScanStatus.QUEUED,
        progress=0,
    )
    db.add(scan_job)
    db.commit()
    db.refresh(scan_job)

    started = scan_execution_manager.start_job(scan_job.id)
    if not started:
        scan_job.status = ScanStatus.FAILED
        scan_job.error_message = "Could not start background scan worker"
        db.commit()
        db.refresh(scan_job)

    return scan_job


@router.get("", response_model=schemas.ScanJobList)
async def get_scan_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    include_all: bool = Query(False, description="Admin-only: include scan jobs from all users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    parsed_status = _parse_status_filter(status_filter)

    query = db.query(ScanJob)
    if current_user.role != UserRole.ADMIN or not include_all:
        query = query.filter(ScanJob.user_id == current_user.id)

    if parsed_status is not None:
        query = query.filter(ScanJob.status == parsed_status)

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(ScanJob.created_at.desc()).offset(offset).limit(page_size).all()

    status_reconciled = False
    for item in items:
        status_reconciled = _reconcile_stale_cancelling(item) or status_reconciled

    if status_reconciled:
        db.commit()

        # Keep response status-accurate after reconciliation in this same request.
        if parsed_status is not None:
            items = [item for item in items if item.status == parsed_status]
            total = query.filter(ScanJob.status == parsed_status).count()
        else:
            total = query.count()

    total_pages = ceil(total / page_size) if total > 0 else 1

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/{scan_id}", response_model=schemas.ScanJob)
async def get_scan_job(
    scan_id: int = ApiPath(..., description="Scan job id"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan_job = _get_scan_job_or_404(scan_id, db)
    _ensure_scan_access(scan_job, current_user)

    if _reconcile_stale_cancelling(scan_job):
        db.commit()
        db.refresh(scan_job)

    return scan_job


@router.get("/{scan_id}/logs", response_model=schemas.ScanLogList)
async def get_scan_logs(
    scan_id: int = ApiPath(..., description="Scan job id"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan_job = _get_scan_job_or_404(scan_id, db)
    _ensure_scan_access(scan_job, current_user)

    query = db.query(ScanLog).filter(ScanLog.scan_job_id == scan_id)
    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(ScanLog.id.asc()).offset(offset).limit(page_size).all()
    total_pages = ceil(total / page_size) if total > 0 else 1

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/{scan_id}/findings", response_model=schemas.ScanFindingList)
async def get_scan_findings(
    scan_id: int = ApiPath(..., description="Scan job id"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan_job = _get_scan_job_or_404(scan_id, db)
    _ensure_scan_access(scan_job, current_user)

    query = db.query(ScanFinding).filter(ScanFinding.scan_job_id == scan_id)
    if severity:
        query = query.filter(ScanFinding.severity == severity.strip().lower())

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(ScanFinding.id.asc()).offset(offset).limit(page_size).all()
    total_pages = ceil(total / page_size) if total > 0 else 1

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/{scan_id}/artifacts", response_model=List[schemas.ScanArtifact])
async def get_scan_artifacts(
    scan_id: int = ApiPath(..., description="Scan job id"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan_job = _get_scan_job_or_404(scan_id, db)
    _ensure_scan_access(scan_job, current_user)

    return (
        db.query(ScanArtifact)
        .filter(ScanArtifact.scan_job_id == scan_id)
        .order_by(ScanArtifact.created_at.desc(), ScanArtifact.id.desc())
        .all()
    )


@router.get("/{scan_id}/download/{artifact}")
async def download_scan_artifact(
    scan_id: int = ApiPath(..., description="Scan job id"),
    artifact: str = ApiPath(..., description="Artifact id or artifact key"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan_job = _get_scan_job_or_404(scan_id, db)
    _ensure_scan_access(scan_job, current_user)

    artifact_query = db.query(ScanArtifact).filter(ScanArtifact.scan_job_id == scan_id)
    artifact_record = None

    if artifact.isdigit():
        artifact_record = artifact_query.filter(ScanArtifact.id == int(artifact)).first()

    if artifact_record is None:
        artifact_record = artifact_query.filter(ScanArtifact.artifact_key == artifact).first()

    if artifact_record is None:
        artifact_record = artifact_query.filter(ScanArtifact.file_name == artifact).first()

    if artifact_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    if not scan_job.artifacts_dir:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact storage path is missing")

    base_dir = Path(scan_job.artifacts_dir).resolve()
    file_path = (base_dir / artifact_record.file_path).resolve()

    if not str(file_path).startswith(str(base_dir)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid artifact path")

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact file not found")

    def _file_iterator():
        with open(file_path, "rb") as file_handle:
            yield from file_handle

    return StreamingResponse(
        _file_iterator(),
        media_type=artifact_record.content_type,
        headers={"Content-Disposition": f"attachment; filename={artifact_record.file_name}"},
    )


@router.post("/{scan_id}/retry", response_model=schemas.ScanJob, status_code=status.HTTP_201_CREATED)
async def retry_scan_job(
    scan_id: int = ApiPath(..., description="Scan job id"),
    payload: Optional[schemas.ScanRetryRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan_job = _get_scan_job_or_404(scan_id, db)
    _ensure_scan_access(scan_job, current_user)

    if scan_job.status in {ScanStatus.RUNNING, ScanStatus.CANCELLING}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot retry a scan while it is running",
        )

    authorization_ack = True if payload is None else payload.authorization_ack
    if not authorization_ack:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authorization acknowledgement is required for defensive scanning workflows",
        )

    retry_job = ScanJob(
        user_id=current_user.id,
        scan_name=scan_job.scan_name,
        target=scan_job.target,
        target_type=scan_job.target_type,
        scan_profile=scan_job.scan_profile,
        planner_engine=scan_job.planner_engine,
        orchestration_mode=scan_job.orchestration_mode,
        max_parallel=scan_job.max_parallel,
        retries=scan_job.retries,
        backoff=scan_job.backoff,
        timeout=scan_job.timeout,
        max_steps=scan_job.max_steps,
        only_tools=scan_job.only_tools,
        authorization_ack=authorization_ack,
        status=ScanStatus.QUEUED,
        progress=0,
    )
    db.add(retry_job)
    db.commit()
    db.refresh(retry_job)

    started = scan_execution_manager.start_job(retry_job.id)
    if not started:
        retry_job.status = ScanStatus.FAILED
        retry_job.error_message = "Could not start background scan worker"
        db.commit()
        db.refresh(retry_job)

    return retry_job


@router.post("/{scan_id}/cancel")
async def cancel_scan_job(
    scan_id: int = ApiPath(..., description="Scan job id"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan_job = _get_scan_job_or_404(scan_id, db)
    _ensure_scan_access(scan_job, current_user)

    if scan_job.status in {ScanStatus.COMPLETED, ScanStatus.FAILED, ScanStatus.CANCELLED}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This scan job is already finished",
        )

    scan_job.status = ScanStatus.CANCELLING
    db.commit()

    scan_execution_manager.cancel_job(scan_id)

    if _reconcile_stale_cancelling(scan_job):
        db.commit()
        message = "Cancellation completed"
    else:
        message = "Cancellation requested"

    db.refresh(scan_job)
    return {"message": message, "scan_id": scan_id, "status": scan_job.status.value}
