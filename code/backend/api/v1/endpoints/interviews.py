from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from crud import interview as crud_interview
from schemas import interview as schema_interview
from schemas import interview_ai as schema_interview_ai
from services.interview_assistant.service import interview_assistant_service

router = APIRouter()
print("Interviews router loaded")

@router.post("/generate", response_model=schema_interview_ai.InterviewPlanGenerateResponse)
async def generate_interview_plan(
    request: schema_interview_ai.InterviewPlanGenerateRequest,
    db: Session = Depends(get_db)
):
    """
    智能生成面试计划
    """
    try:
        print(f"Generating interview plan for candidate {request.candidate_id}")
        return await interview_assistant_service.generate_interview_plan(db, request)
    except Exception as e:
        import traceback
        error_msg = f"Error in generate_interview_plan: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/regenerate-question", response_model=schema_interview_ai.InterviewQuestion)
async def regenerate_single_question(
    request: schema_interview_ai.InterviewQuestionRegenerateRequest,
    db: Session = Depends(get_db)
):
    """
    单题重新生成
    """
    try:
        print(f"Regenerating single question for candidate {request.candidate_id}")
        return await interview_assistant_service.regenerate_single_question(db, request)
    except Exception as e:
        import traceback
        error_msg = f"Error in regenerate_single_question: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/complete-manual-question", response_model=schema_interview_ai.InterviewQuestion)
async def complete_manual_question(
    request: schema_interview_ai.InterviewQuestionManualCompleteRequest,
    db: Session = Depends(get_db)
):
    """
    手动录入题目补充元数据
    """
    try:
        print(f"Completing manual question for candidate {request.candidate_id}")
        return await interview_assistant_service.complete_manual_question(db, request)
    except Exception as e:
        import traceback
        error_msg = f"Error in complete_manual_question: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/refresh-criteria", response_model=schema_interview_ai.InterviewCriteriaRefreshResponse)
async def refresh_evaluation_criteria(
    request: schema_interview_ai.InterviewCriteriaRefreshRequest,
    db: Session = Depends(get_db)
):
    """
    根据最新题目列表刷新评分维度
    """
    try:
        print(f"Refreshing evaluation criteria for candidate {request.candidate_id}")
        return await interview_assistant_service.refresh_evaluation_criteria(db, request)
    except Exception as e:
        import traceback
        error_msg = f"Error in refresh_evaluation_criteria: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[schema_interview.Interview])
def read_interviews(
    skip: int = 0,
    limit: int = 100,
    interviewer_id: Optional[int] = None,
    candidate_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(crud_interview.Interview)
    if interviewer_id:
        query = query.filter(crud_interview.Interview.interviewer_id == interviewer_id)
    if candidate_id:
        query = query.filter(crud_interview.Interview.candidate_id == candidate_id)
    if status:
        query = query.filter(crud_interview.Interview.status == status)
    return query.offset(skip).limit(limit).all()

@router.post("/", response_model=schema_interview.Interview)
def create_interview_record(
    interview: schema_interview.InterviewCreate,
    db: Session = Depends(get_db)
):
    """
    创建面试记录（分配面试官）
    """
    print(f"Creating interview for candidate {interview.candidate_id}, interviewer {interview.interviewer_id}")
    
    # 验证候选人是否存在
    from models.candidate import Candidate
    candidate = db.query(Candidate).filter(Candidate.id == interview.candidate_id).first()
    if not candidate:
        print(f"Candidate {interview.candidate_id} not found")
        raise HTTPException(status_code=404, detail=f"候选人(ID:{interview.candidate_id})不存在")

    # 验证面试官是否存在
    from models.user import User
    interviewer = db.query(User).filter(User.id == interview.interviewer_id).first()
    if not interviewer:
        print(f"Interviewer {interview.interviewer_id} not found")
        raise HTTPException(status_code=404, detail=f"面试官(ID:{interview.interviewer_id})不存在")

    # 验证管理员是否存在
    admin = db.query(User).filter(User.id == interview.admin_id).first()
    if not admin:
        print(f"Admin {interview.admin_id} not found")
        raise HTTPException(status_code=404, detail=f"管理员(ID:{interview.admin_id})不存在")

    # 检查该候选人是否已有活跃面试（除了已完成、已取消、已拒绝之外的状态）
    active_statuses = ["pending", "accepted", "preparing", "in_progress"]
    existing_active = db.query(crud_interview.Interview).filter(
        crud_interview.Interview.candidate_id == interview.candidate_id,
        crud_interview.Interview.status.in_(active_statuses)
    ).first()
    
    if existing_active:
        print(f"Candidate {interview.candidate_id} already has an active interview {existing_active.id}")
        raise HTTPException(
            status_code=400, 
            detail="该候选人已有正在进行的面试安排，无法重复分配"
        )
        
    try:
        return crud_interview.create_interview(db=db, interview=interview)
    except Exception as e:
        print(f"Database error creating interview: {str(e)}")
        raise HTTPException(status_code=500, detail=f"数据库创建失败: {str(e)}")

@router.get("/{interview_id}", response_model=schema_interview.Interview)
def read_interview(
    interview_id: int,
    db: Session = Depends(get_db)
):
    db_interview = db.query(crud_interview.Interview).filter(crud_interview.Interview.id == interview_id).first()
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return db_interview

@router.put("/{interview_id}", response_model=schema_interview.Interview)
def update_interview(
    interview_id: int,
    interview_update: schema_interview.InterviewUpdate,
    db: Session = Depends(get_db)
):
    print(f"Updating interview {interview_id} with data: {interview_update.model_dump(exclude_unset=True)}")
    db_interview = crud_interview.update_interview(db, interview_id=interview_id, interview_update=interview_update)
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    print(f"Update successful for interview {interview_id}")
    return db_interview
