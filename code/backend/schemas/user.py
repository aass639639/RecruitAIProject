from pydantic import BaseModel
from typing import Optional

class UserBase(BaseModel):
    username: str
    full_name: str
    role: str
    department: Optional[str] = None

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int

    class Config:
        from_attributes = True
