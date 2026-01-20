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
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
