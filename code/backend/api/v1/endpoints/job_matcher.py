from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from services.job_matcher.service import job_matcher_service
from typing import List

from pydantic import BaseModel
from typing import List, Any

class MatchAnalyzeRequest(BaseModel):
    candidate: Any
    jd: str

router = APIRouter()

@router.post("/analyze")
async def analyze_match(
    request: MatchAnalyzeRequest,
    db: Session = Depends(get_db)
):
    """
    进行人岗匹配分析
    """
    try:
        return await job_matcher_service.analyze_match(request.candidate, request.jd)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
