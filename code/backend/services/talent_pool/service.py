from sqlalchemy.orm import Session
from typing import List, Optional, Tuple, Any
from crud import candidate as crud_candidate
from crud import job_description as crud_jd
from schemas import candidate as schema_candidate
from schemas import job_description as schema_jd
from services.resume_parser.service import ResumeParserService

class TalentPoolService:
    def get_candidates(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        position: Optional[str] = None,
        job_id: Optional[int] = None,
        status: Optional[str] = None,
        exclude_status: Optional[str] = None
    ):
        return crud_candidate.get_candidates(
            db, 
            skip=skip, 
            limit=limit, 
            search=search, 
            position=position, 
            job_id=job_id, 
            status=status,
            exclude_status=exclude_status
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
        # 获取原有数据以检查状态变化
        old_candidate = crud_candidate.get_candidate(db, candidate_id)
        if not old_candidate:
            return None
            
        old_status = old_candidate.status
        update_dict = candidate_update.model_dump(exclude_unset=True)
        new_status = update_dict.get("status")
        job_id = update_dict.get("job_id") or old_candidate.job_id

        # 执行更新
        db_candidate = crud_candidate.update_candidate(
            db, candidate_id=candidate_id, candidate_data=update_dict
        )

        # 逻辑：如果状态变为 hired，且有关联 JD，则增加 JD 的已入职人数
        if new_status == "hired" and old_status != "hired" and job_id:
            jd = crud_jd.get_job_description(db, job_id)
            if jd:
                crud_jd.update_job_description(db, job_id, schema_jd.JobDescriptionUpdate(
                    current_hired_count=jd.current_hired_count + 1
                ))

        return db_candidate

    def delete_candidate(self, db: Session, candidate_id: int):
        return crud_candidate.delete_candidate(db, candidate_id=candidate_id)

    async def create_candidate_from_resume(self, db: Session, resume_text: str) -> dict:
        """
        AI 解析并入库候选人（抽取自 tools.py）
        """
        parser = ResumeParserService()
        # 1. AI 解析
        resume_data = await parser.parse_resume(resume_text)
        
        # 2. 入库 - 转换为前端兼容的格式
        experience_data = []
        if resume_data.work_experience:
            for exp in resume_data.work_experience:
                experience_data.append({
                    "company": exp.company_name,
                    "position": exp.position,
                    "period": f"{exp.start_date} - {exp.end_date}",
                    "description": "\n".join(exp.description) if isinstance(exp.description, list) else exp.description
                })

        projects_data = []
        if resume_data.projects:
            for proj in resume_data.projects:
                projects_data.append({
                    "name": proj.name,
                    "role": proj.role,
                    "period": f"{proj.start_date} - {proj.end_date}" if proj.start_date else "",
                    "description": proj.description,
                    "technologies": proj.technologies
                })

        candidate_create = schema_candidate.CandidateCreate(
            name=resume_data.name,
            email=resume_data.email,
            phone=resume_data.phone,
            position=resume_data.position or "未分类",
            education=resume_data.education_summary or (resume_data.education[0].school_name if resume_data.education else "未知"),
            skills=resume_data.skill_tags,
            experience=experience_data,
            experience_list=getattr(resume_data, 'experience_list', []),
            projects=projects_data,
            summary=resume_data.summary,
            parsing_score=resume_data.parsing_score,
            years_of_experience=resume_data.years_of_experience
        )
        
        new_candidate, error = self.create_candidate(db, candidate_create)
        if error:
            return {"status": "error", "message": error}
        
        return {
            "status": "success",
            "message": f"候选人【{new_candidate.name}】已成功入库",
            "candidate_id": new_candidate.id,
            "name": new_candidate.name
        }

talent_pool_service = TalentPoolService()
