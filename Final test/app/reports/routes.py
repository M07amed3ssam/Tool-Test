from fastapi import APIRouter, Depends, HTTPException, status, Path, Query, Body
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import json
from math import ceil
from pathlib import Path as PathLib

from app.db.database import get_db
from app.auth.utils import get_current_user
from app.auth.models import User
from app.reports import schemas, models, utils as report_utils

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.post("", response_model=schemas.Report, status_code=status.HTTP_201_CREATED)
async def create_report(
    source_dir: str = Body(..., embed=True, description="Source directory containing report files"),
    report_name: str = Body(..., embed=True, description="Name of the report"),
    domain: str = Body(..., embed=True, description="Domain name for the report"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new report by copying files from a source directory"""
    try:
        # Copy report files to user's directory
        file_paths = report_utils.copy_report_files(source_dir, current_user.id, report_name)
        
        # Create the report record
        db_report = models.Report(
            user_id=current_user.id,
            report_name=report_name,
            domain=domain,
            final_file=file_paths["final_file"],
            full_file=file_paths["full_file"]
        )
        
        db.add(db_report)
        db.commit()
        db.refresh(db_report)
        
        return db_report
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise e
    except Exception as e:
        # Handle other exceptions
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating report: {str(e)}"
        )

@router.get("", response_model=schemas.ReportList)
async def get_reports(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get paginated list of reports for the authenticated user"""
    # Calculate offset for pagination
    offset = (page - 1) * page_size
    
    # Get total count of user's reports
    total = db.query(models.Report).filter(models.Report.user_id == current_user.id).count()
    
    # Get paginated reports
    reports = db.query(models.Report).filter(
        models.Report.user_id == current_user.id
    ).order_by(
        models.Report.created_at.desc()
    ).offset(offset).limit(page_size).all()
    
    # Calculate total pages
    total_pages = ceil(total / page_size) if total > 0 else 1
    
    return {
        "items": reports,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@router.get("/{report_id}/final", response_class=JSONResponse)
async def get_final_report(
    report_id: int = Path(..., description="The ID of the report to retrieve"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the Final_report.json for a specific report"""
    # Get the report
    report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.user_id == current_user.id
    ).first()
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Get the file path
    file_path = report_utils.get_final_report_path(report.user_id, report.report_name)
    
    # Check if file exists
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report file not found"
        )
    
    # Read and return the JSON content
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading report file: {str(e)}"
        )

@router.get("/{report_id}/download-full")
async def download_full_report(
    report_id: int = Path(..., description="The ID of the report to download"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download the Full_data.json file for a specific report"""
    # Get the report
    report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.user_id == current_user.id
    ).first()
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Get the file path
    file_path = report_utils.get_full_report_path(report.user_id, report.report_name)
    
    # Check if file exists
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report file not found"
        )
    
    # Define a generator function to stream the file
    def file_iterator():
        with open(file_path, "rb") as file:
            yield from file
    
    # Return a streaming response
    return StreamingResponse(
        file_iterator(),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename={report.report_name}_Full_data.json"
        }
    )