from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from services.agent.service import agent_service
from utils.file_parser import extract_text_from_file
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class ChatMessage(BaseModel):
    role: str
    content: str

class AgentChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

class AgentChatResponse(BaseModel):
    answer: str
    status: str

@router.post("/chat", response_model=AgentChatResponse)
async def chat_with_agent(request: AgentChatRequest):
    """
    与招聘 Agent 进行对话
    """
    # 将 Pydantic 模型转换为字典列表
    history_dicts = [{"role": m.role, "content": m.content} for m in request.history] if request.history else []
    
    result = await agent_service.chat(
        user_input=request.message,
        chat_history=history_dicts
    )
    
    return AgentChatResponse(
        answer=result["answer"],
        status=result["status"]
    )

@router.post("/upload")
async def upload_file_to_agent(file: UploadFile = File(...)):
    """
    上传文件并提取文本，供 Agent 进一步处理
    """
    try:
        content = await file.read()
        text = extract_text_from_file(content, file.filename)
        if not text.strip():
            raise HTTPException(status_code=400, detail="文件内容为空，无法解析")
        
        return {
            "status": "success",
            "filename": file.filename,
            "content": text
        }
    except Exception as e:
        logger.error(f"Error uploading file to agent: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
