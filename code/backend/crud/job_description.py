from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from datetime import datetime
from models.job_description import JobDescription
from schemas.job_description import JobDescriptionCreate, JobDescriptionUpdate

def get_job_description(db: Session, jd_id: int):
    return db.query(JobDescription).filter(JobDescription.id == jd_id).first()

def get_job_descriptions(db: Session, skip: int = 0, limit: int = 100, search: Optional[str] = None, only_active: bool = False):
    query = db.query(JobDescription)
    
    if only_active:
        query = query.filter(
            JobDescription.is_active == True,
            JobDescription.current_hired_count < JobDescription.requirement_count
        )

    if search:
        search_terms = search.split()
        or_filters = []
        for term in search_terms:
            term_filter = f"%{term}%"
            or_filters.append(
                or_(
                    JobDescription.title.ilike(term_filter),
                    JobDescription.description.ilike(term_filter),
                    JobDescription.category.ilike(term_filter)
                )
            )
        # 改进：将原本的 AND 逻辑改为更宽松的 OR 逻辑，以提高召回率
        query = query.filter(or_(*or_filters))
            
    return query.offset(skip).limit(limit).all()

def create_job_description(db: Session, jd: JobDescriptionCreate):
    db_jd = JobDescription(**jd.model_dump())
    if db_jd.created_at is None:
        db_jd.created_at = datetime.now()
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
