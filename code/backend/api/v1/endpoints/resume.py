from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from schemas.resume import ResumeParseRequest, ResumeParseResponse
from services.resume_parser.service import resume_parser_service
from utils.file_parser import extract_text_from_file
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

@router.post("/upload", response_model=ResumeParseResponse)
async def upload_resume(file: UploadFile = File(...)):
    """
    上传简历文件并解析
    """
    try:
        content = await file.read()
        text = extract_text_from_file(content, file.filename)
        if not text.strip():
            raise HTTPException(status_code=400, detail="文件内容为空，无法解析")
        
        result = await resume_parser_service.parse_resume(text)
        # 将提取的原始文本也存入结果中（如果模型支持）
        if hasattr(result, 'raw_text'):
            result.raw_text = text
            
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"API Error in upload_resume: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
