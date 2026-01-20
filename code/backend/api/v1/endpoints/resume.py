from fastapi import APIRouter, HTTPException, Depends
from schemas.resume import ResumeParseRequest, ResumeParseResponse
from services.resume_parser.service import resume_parser_service
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/parse", response_model=ResumeParseResponse)
async def parse_resume(request: ResumeParseRequest):
    """
    解析简历原始文本并返回结构化数据
    """
    try:
        result = await resume_parser_service.parse_resume(request.text)
        return result
    except Exception as e:
        logger.error(f"API Error in parse_resume: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
