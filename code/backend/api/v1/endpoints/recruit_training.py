from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from services.recruit_training.service import recruit_training_service
from typing import List

router = APIRouter()

@router.get("/recommendations/{candidate_id}")
async def get_training_recommendations(
    candidate_id: int,
    db: Session = Depends(get_db)
):
    """
    为候选人推荐入职培训课程
    """
    try:
        return await recruit_training_service.get_training_recommendations(db, candidate_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
