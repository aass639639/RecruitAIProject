from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Notification(BaseModel):
    id: int
    content: str
    time: str
    type: str # completed, accepted, scheduled, pending
    job_id: Optional[int] = None

class DashboardData(BaseModel):
    notifications: List[Notification]
