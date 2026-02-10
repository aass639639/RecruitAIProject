from pydantic import BaseModel
from typing import List, Optional

class KnowledgeItem(BaseModel):
    id: str
    title: str
    category: str
    content: str
    tags: List[str]
    updatedAt: str

    class Config:
        from_attributes = True

class KnowledgeItemCreate(BaseModel):
    title: str
    category: str
    content: str
    tags: List[str]

class KnowledgeQuery(BaseModel):
    question: str
    session_id: Optional[str] = "default"

class KnowledgeAnswer(BaseModel):
    answer: str
    source_ids: List[str]

class KnowledgeTipRequest(BaseModel):
    title: str
    content: str

class KnowledgeTipResponse(BaseModel):
    tip: str
