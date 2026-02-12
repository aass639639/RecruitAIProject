from sqlalchemy.orm import Session
from sqlalchemy import or_, cast, String
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
    status: Optional[str] = None,
    exclude_status: Optional[str] = None
):
    query = db.query(Candidate)
    
    if search:
        # 支持空格分词搜索
        search_terms = search.split()
        or_filters = []
        for term in search_terms:
            term_filter = f"%{term}%"
            or_filters.append(
                or_(
                    Candidate.name.ilike(term_filter),
                    Candidate.position.ilike(term_filter),
                    Candidate.summary.ilike(term_filter),
                    cast(Candidate.skills, String).ilike(term_filter)
                )
            )
        # 改进：将原本的 AND 逻辑改为更宽松的 OR 逻辑，以提高召回率
        # 如果关键词很多，AND 逻辑太严苛了
        query = query.filter(or_(*or_filters))
    
    if position and position != "全部":
        # 检查该 position 是否匹配系统中已有的分类
        # 如果不匹配（比如 Agent 传了“技术类”），则不作为硬性过滤条件，避免搜不到人
        standard_positions = ['研发', 'Data Scientist', 'IT支持', '财务', '生产运营', '物流/供应链管理', 'MEP设计工程师']
        is_standard = any(p in position or position in p for p in standard_positions)
        
        if is_standard:
            query = query.filter(Candidate.position.ilike(f"%{position}%"))
        else:
            # 如果不是标准分类，将其加入模糊搜索逻辑中
            term_filter = f"%{position}%"
            query = query.filter(
                or_(
                    Candidate.position.ilike(term_filter),
                    Candidate.summary.ilike(term_filter),
                    cast(Candidate.skills, String).ilike(term_filter)
                )
            )
        
    if job_id:
        query = query.filter(Candidate.job_id == job_id)
        
    if status:
        query = query.filter(Candidate.status == status)
        
    if exclude_status:
        query = query.filter(Candidate.status != exclude_status)
        
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
