from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from crud import job_description as crud_jd
from schemas import job_description as schema_jd
from services.jd_intelligence.service import jd_intelligence_service

router = APIRouter()

@router.post("/smart-generate", response_model=schema_jd.JobDescriptionSmartResponse)
async def smart_generate_job_description(request: schema_jd.JobDescriptionSmartRequest):
    """
    AI 智能生成或优化 JD
    """
    result = await jd_intelligence_service.smart_generate_jd(request.input_text)
    return result

@router.get("/", response_model=List[schema_jd.JobDescription])
def read_job_descriptions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud_jd.get_job_descriptions(db, skip=skip, limit=limit)

@router.post("/", response_model=schema_jd.JobDescription)
def create_job_description(jd: schema_jd.JobDescriptionCreate, db: Session = Depends(get_db)):
    return crud_jd.create_job_description(db, jd)

@router.get("/{jd_id}", response_model=schema_jd.JobDescription)
def read_job_description(jd_id: int, db: Session = Depends(get_db)):
    db_jd = crud_jd.get_job_description(db, jd_id)
    if not db_jd:
        raise HTTPException(status_code=404, detail="Job Description not found")
    return db_jd

@router.put("/{jd_id}", response_model=schema_jd.JobDescription)
def update_job_description(jd_id: int, jd: schema_jd.JobDescriptionUpdate, db: Session = Depends(get_db)):
    db_jd = crud_jd.update_job_description(db, jd_id, jd)
    if not db_jd:
        raise HTTPException(status_code=404, detail="Job Description not found")
    return db_jd

@router.delete("/{jd_id}")
def delete_job_description(jd_id: int, db: Session = Depends(get_db)):
    db_jd = crud_jd.delete_job_description(db, jd_id)
    if not db_jd:
        raise HTTPException(status_code=404, detail="Job Description not found")
    return {"message": "Job Description deleted successfully"}
