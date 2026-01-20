from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from .candidate import Candidate
from .user import User

class InterviewBase(BaseModel):
    candidate_id: int
    interviewer_id: int
    admin_id: int
    status: str = "pending"
    interview_time: Optional[datetime] = None

class InterviewCreate(InterviewBase):
    pass

class InterviewUpdate(BaseModel):
    status: Optional[str] = None
    questions: Optional[List[dict]] = None
    evaluation_criteria: Optional[List[str]] = None
    notes: Optional[str] = None
    hiring_decision: Optional[str] = None
    interview_time: Optional[datetime] = None

class Interview(InterviewBase):
    id: int
    questions: Optional[List[dict]] = None
    evaluation_criteria: Optional[List[str]] = None
    notes: Optional[str] = None
    hiring_decision: Optional[str] = None
    interview_time: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    candidate: Optional[Candidate] = None
    interviewer: Optional[User] = None
    admin: Optional[User] = None

    class Config:
        from_attributes = True
