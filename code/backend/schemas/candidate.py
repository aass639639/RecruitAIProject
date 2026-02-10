from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any

class CandidateBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    education: Optional[str] = None
    experience: List[Any] = []
    projects: List[Any] = []
    skills: List[str] = []
    summary: Optional[str] = None
    education_summary: Optional[str] = None
    experience_list: List[str] = []
    skill_tags: List[str] = []
    parsing_score: int = 0
    position: Optional[str] = None
    years_of_experience: float = 0
    status: str = "none"
    job_id: Optional[int] = None

class CandidateCreate(CandidateBase):
    pass

class CandidateUpdate(BaseModel):
    status: Optional[str] = None
    job_id: Optional[int] = None

class Candidate(CandidateBase):
    id: int

    class Config:
        from_attributes = True
