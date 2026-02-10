from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from schemas import candidate as schema_candidate
from services.talent_pool.service import talent_pool_service

router = APIRouter()

@router.get("/", response_model=List[schema_candidate.Candidate])
def read_candidates(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    position: Optional[str] = None,
    job_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return talent_pool_service.get_candidates(
        db, skip=skip, limit=limit, search=search, position=position, job_id=job_id, status=status
    )

@router.post("/", response_model=schema_candidate.Candidate)
def create_candidate(
    candidate: schema_candidate.CandidateCreate,
    db: Session = Depends(get_db)
):
    db_candidate, error = talent_pool_service.create_candidate(db, candidate)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return db_candidate

@router.get("/{candidate_id}", response_model=schema_candidate.Candidate)
def read_candidate(candidate_id: int, db: Session = Depends(get_db)):
    db_candidate = talent_pool_service.get_candidate(db, candidate_id=candidate_id)
    if db_candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return db_candidate

@router.delete("/{candidate_id}")
def delete_candidate(candidate_id: int, db: Session = Depends(get_db)):
    db_candidate = talent_pool_service.delete_candidate(db, candidate_id=candidate_id)
    if db_candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"message": "Candidate deleted successfully"}

@router.put("/{candidate_id}", response_model=schema_candidate.Candidate)
def update_candidate(
    candidate_id: int,
    candidate_update: schema_candidate.CandidateUpdate,
    db: Session = Depends(get_db)
):
    db_candidate = talent_pool_service.update_candidate(
        db, candidate_id=candidate_id, candidate_update=candidate_update
    )
    if db_candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return db_candidate
