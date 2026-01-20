from sqlalchemy.orm import Session
from models.interview import Interview
from schemas.interview import InterviewCreate, InterviewUpdate

def get_interview(db: Session, interview_id: int):
    return db.query(Interview).filter(Interview.id == interview_id).first()

def get_interviews(db: Session, skip: int = 0, limit: int = 100, interviewer_id: int = None, status: str = None):
    query = db.query(Interview)
    if interviewer_id:
        query = query.filter(Interview.interviewer_id == interviewer_id)
    if status:
        query = query.filter(Interview.status == status)
    return query.offset(skip).limit(limit).all()

def create_interview(db: Session, interview: InterviewCreate):
    db_interview = Interview(**interview.model_dump())
    db.add(db_interview)
    db.commit()
    db.refresh(db_interview)
    return db_interview

def update_interview(db: Session, interview_id: int, interview_update: InterviewUpdate):
    db_interview = get_interview(db, interview_id)
    if db_interview:
        for key, value in interview_update.model_dump(exclude_unset=True).items():
            setattr(db_interview, key, value)
        db.commit()
        db.refresh(db_interview)
    return db_interview
