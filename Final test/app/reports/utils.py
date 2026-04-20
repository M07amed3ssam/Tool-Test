import os
import shutil
from pathlib import Path
from fastapi import HTTPException, status

# Base directory for storing report files
BASE_REPORTS_DIR = Path("app/data/reports")

def ensure_user_directory(user_id):
    """Ensure the user's report directory exists"""
    user_dir = BASE_REPORTS_DIR / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir

def get_report_path(user_id, report_name):
    """Get the path to a specific report directory"""
    return BASE_REPORTS_DIR / str(user_id) / report_name

def get_final_report_path(user_id, report_name):
    """Get the path to a Final_report.json file"""
    return get_report_path(user_id, report_name) / "Final_report.json"

def get_full_report_path(user_id, report_name):
    """Get the path to a Full_data.json file"""
    return get_report_path(user_id, report_name) / "Full_data.json"

def copy_report_files(source_dir, user_id, report_name):
    """Copy report files from source directory to user's report directory"""
    source_path = Path(source_dir)
    if not source_path.exists() or not source_path.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Source directory {source_dir} does not exist"
        )
    
    # Check if source files exist
    source_final = source_path / "Final_report.json"
    source_full = source_path / "Full_data.json"
    
    if not source_final.exists() or not source_full.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source directory missing required report files"
        )
    
    # Create destination directory
    dest_dir = ensure_user_directory(user_id) / report_name
    dest_dir.mkdir(exist_ok=True)
    
    # Copy files
    shutil.copy2(source_final, dest_dir / "Final_report.json")
    shutil.copy2(source_full, dest_dir / "Full_data.json")
    
    return {
        "final_file": str(dest_dir / "Final_report.json"),
        "full_file": str(dest_dir / "Full_data.json")
    }