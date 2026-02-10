from sqlalchemy.orm import Session
from models.candidate import Candidate
from typing import List, Optional

def get_candidate(db: Session, candidate_id: int):
    return db.query(Candidate).filter(Candidate.id == candidate_id).first()

def get_candidates(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    search: Optional[str] = None,
    position: Optional[str] = None,
    job_id: Optional[int] = None,
    status: Optional[str] = None
):
    query = db.query(Candidate)
    
    if search:
        query = query.filter(
            (Candidate.name.contains(search)) | 
            (Candidate.skills.contains(search))
        )
    
    if position and position != "全部":
        query = query.filter(Candidate.position == position)
        
    if job_id:
        query = query.filter(Candidate.job_id == job_id)
        
    if status:
        query = query.filter(Candidate.status == status)
        
    return query.offset(skip).limit(limit).all()

def get_candidate_by_name_and_contact(db: Session, name: str, email: Optional[str] = None, phone: Optional[str] = None):
    query = db.query(Candidate).filter(Candidate.name == name)
    if email:
        query = query.filter(Candidate.email == email)
    if phone:
        query = query.filter(Candidate.phone == phone)
    return query.first()

def create_candidate(db: Session, candidate_data: dict):
    # 处理可能的字段差异
    db_candidate = Candidate(**candidate_data)
    db.add(db_candidate)
    db.commit()
    db.refresh(db_candidate)
    return db_candidate

def delete_candidate(db: Session, candidate_id: int):
    db_candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if db_candidate:
        db.delete(db_candidate)
        db.commit()
    return db_candidate

def update_candidate(db: Session, candidate_id: int, candidate_data: dict):
    db_candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if db_candidate:
        for key, value in candidate_data.items():
            if value is not None:
                setattr(db_candidate, key, value)
        db.commit()
        db.refresh(db_candidate)
    return db_candidate
