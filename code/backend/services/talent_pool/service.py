from sqlalchemy.orm import Session
from typing import List, Optional
from crud import candidate as crud_candidate
from schemas import candidate as schema_candidate

class TalentPoolService:
    def get_candidates(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        position: Optional[str] = None
    ):
        return crud_candidate.get_candidates(
            db, skip=skip, limit=limit, search=search, position=position
        )

    def get_candidate(self, db: Session, candidate_id: int):
        return crud_candidate.get_candidate(db, candidate_id=candidate_id)

    def create_candidate(self, db: Session, candidate: schema_candidate.CandidateCreate):
        existing = crud_candidate.get_candidate_by_name_and_contact(
            db, 
            name=candidate.name, 
            email=candidate.email, 
            phone=candidate.phone
        )
        if existing:
            return None, "该人才已存在于人才库中"
        
        db_candidate = crud_candidate.create_candidate(db=db, candidate_data=candidate.model_dump())
        return db_candidate, None

    def update_candidate(self, db: Session, candidate_id: int, candidate_update: schema_candidate.CandidateUpdate):
        db_candidate = crud_candidate.update_candidate(
            db, candidate_id=candidate_id, candidate_data=candidate_update.model_dump(exclude_unset=True)
        )
        return db_candidate

    def delete_candidate(self, db: Session, candidate_id: int):
        return crud_candidate.delete_candidate(db, candidate_id=candidate_id)

talent_pool_service = TalentPoolService()
