from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime

class JobDescriptionBase(BaseModel):
    title: str
    description: Optional[str] = None
    requirement_count: int = 0
    is_active: bool = True
    category: Optional[str] = "其他"
    close_reason: Optional[str] = None

class JobDescriptionCreate(JobDescriptionBase):
    pass

class JobDescriptionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requirement_count: Optional[int] = None
    current_hired_count: Optional[int] = None
    is_active: Optional[bool] = None
    category: Optional[str] = None
    close_reason: Optional[str] = None

class JobDescriptionSmartRequest(BaseModel):
    input_text: str

class JobDescriptionSmartResponse(BaseModel):
    title: str
    description: str

class JobDescription(JobDescriptionBase):
    id: int
    current_hired_count: int
    created_at: Optional[datetime] = None

    @field_validator('created_at', mode='before')
    @classmethod
    def set_created_at(cls, v):
        return v or datetime.now()

    class Config:
        from_attributes = True
