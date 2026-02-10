from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from services.knowledge.service import knowledge_service
from schemas.knowledge import KnowledgeQuery, KnowledgeAnswer, KnowledgeItem, KnowledgeItemCreate, KnowledgeTipRequest, KnowledgeTipResponse
from crud.knowledge import create_knowledge as crud_create_knowledge
from typing import List

router = APIRouter()

@router.get("/", response_model=List[KnowledgeItem])
async def get_knowledge_base(db: Session = Depends(get_db)):
    """
    获取所有知识库条目
    """
    return await knowledge_service.get_all_knowledge(db)

@router.post("/tip", response_model=KnowledgeTipResponse)
async def get_knowledge_tip(request: KnowledgeTipRequest):
    """
    获取 AI 面试官提示
    """
    try:
        tip = await knowledge_service.get_ai_tip(request.title, request.content)
        return KnowledgeTipResponse(tip=tip)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=KnowledgeItem)
async def add_knowledge(knowledge: KnowledgeItemCreate, db: Session = Depends(get_db)):
    """
    录入新知识
    """
    try:
        db_knowledge = crud_create_knowledge(db, knowledge)
        return KnowledgeItem(
            id=str(db_knowledge.id),
            title=db_knowledge.title,
            category=db_knowledge.category,
            content=db_knowledge.content,
            tags=db_knowledge.tags,
            updatedAt=db_knowledge.updated_at.strftime("%Y-%m-%d")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat", response_model=KnowledgeAnswer)
async def chat_with_knowledge(request: KnowledgeQuery, db: Session = Depends(get_db)):
    """
    AI 问答接口，优先搜索知识库
    """
    try:
        return await knowledge_service.chat_with_knowledge(db, request.question, request.session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
