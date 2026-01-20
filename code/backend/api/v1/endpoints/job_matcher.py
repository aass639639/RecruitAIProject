from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from services.job_matcher.service import job_matcher_service
from typing import List

router = APIRouter()

@router.post("/match/{candidate_id}")
async def match_job(
    candidate_id: int,
    jd: str,
    db: Session = Depends(get_db)
):
    """
    根据 JD 匹配候选人
    """
    try:
        return await job_matcher_service.match_job(db, candidate_id, jd)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
