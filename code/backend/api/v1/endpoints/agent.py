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
async def upload_files_to_agent(files: List[UploadFile] = File(...)):
    """
    支持多文件上传并提取文本，供 Agent 进一步处理
    """
    results = []
    for file in files:
        try:
            content = await file.read()
            text = extract_text_from_file(content, file.filename)
            if not text.strip():
                results.append({
                    "status": "error",
                    "filename": file.filename,
                    "detail": "文件内容为空，无法解析"
                })
                continue
            
            results.append({
                "status": "success",
                "filename": file.filename,
                "content": text
            })
        except Exception as e:
            logger.error(f"Error uploading file {file.filename} to agent: {str(e)}")
            results.append({
                "status": "error",
                "filename": file.filename,
                "detail": str(e)
            })
    
    # 为了兼容前端现有的单文件处理逻辑，如果只上传了一个文件，直接返回该对象
    if len(results) == 1:
        return results[0]
        
    return results
