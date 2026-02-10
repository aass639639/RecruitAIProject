from pydantic_settings import BaseSettings
from typing import List
import os
from . import KEY

class Settings(BaseSettings):
    PROJECT_NAME: str = "RecruitAI"
    API_V1_STR: str = "/api/v1"
    
    # CORS 配置
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:5173",
    ]
    
    # Gemini 配置
    GEMINI_API_KEY: str = KEY.GEMINI_API_KEY
    GEMINI_MODEL: str = KEY.GEMINI_MODEL
    
    # Doubao (Ark) 配置
    ARK_API_KEY: str = KEY.ARK_API_KEY
    ARK_BASE_URL: str = KEY.ARK_BASE_URL
    ARK_MODEL: str = KEY.ARK_MODEL
    
    # RAG 模型配置 (全量切换至火山引擎 Ark)
    EMBEDDING_MODEL: str = KEY.ARK_EMBEDDING_MODEL
    LLM_MODEL: str = KEY.ARK_MODEL
    
    # Chroma 配置
    CHROMA_DB_PATH: str = "./chroma_db"
    COLLECTION_NAME: str = "hr_documents"
    
    # RAG 参数
    DENSE_K: int = 3
    SPARSE_K: int = 3
    
    # 提示词模板
    HR_SYSTEM_PROMPT: str = """你是一个专业的公司 HR 助手，请根据以下提供的公司内部 HR 文档内容回答问题。
- 请确保答案准确、简洁、专业。
- 如果文档中没有明确信息，请说明"我还没有学会相关知识😭，问点别的吧~"。
- 不要编造信息。"""

    GENERAL_SYSTEM_PROMPT: str = """你是一个知识渊博、乐于助人的 AI 助手。请基于你的通用知识回答以下问题，保持回答准确、简洁、有帮助。
如果你不确定答案，可以诚实说明。"""

    SMALL_TALK_SYSTEM_PROMPT: str = """你是一个友好、礼貌的 AI 助手。请用简洁得体的方式回答用户的日常对话。"""

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
