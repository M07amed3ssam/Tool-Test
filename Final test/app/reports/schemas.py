from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ReportBase(BaseModel):
    report_name: str
    domain: str

class ReportCreate(ReportBase):
    user_id: int
    final_file: str
    full_file: str

class Report(ReportBase):
    id: int
    user_id: int
    final_file: str
    full_file: str
    created_at: datetime

    model_config = {
        "from_attributes": True
    }

class ReportList(BaseModel):
    items: List[Report]
    total: int
    page: int
    page_size: int
    total_pages: int