from sqlalchemy.orm import Session
from models.job_description import JobDescription
from schemas.job_description import JobDescriptionCreate, JobDescriptionUpdate

def get_job_description(db: Session, jd_id: int):
    return db.query(JobDescription).filter(JobDescription.id == jd_id).first()

def get_job_descriptions(db: Session, skip: int = 0, limit: int = 100):
    return db.query(JobDescription).offset(skip).limit(limit).all()

def create_job_description(db: Session, jd: JobDescriptionCreate):
    db_jd = JobDescription(**jd.model_dump())
    db.add(db_jd)
    db.commit()
    db.refresh(db_jd)
    return db_jd

def update_job_description(db: Session, jd_id: int, jd: JobDescriptionUpdate):
    db_jd = get_job_description(db, jd_id)
    if not db_jd:
        return None
    
    update_data = jd.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_jd, key, value)
    
    db.commit()
    db.refresh(db_jd)
    return db_jd

def delete_job_description(db: Session, jd_id: int):
    db_jd = get_job_description(db, jd_id)
    if db_jd:
        db.delete(db_jd)
        db.commit()
    return db_jd
