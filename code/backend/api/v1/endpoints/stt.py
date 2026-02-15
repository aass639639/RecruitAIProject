from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Dict, Any
import os
import uuid
import shutil

router = APIRouter()

try:
    from faster_whisper import WhisperModel
    import torch
    
    # 初始化模型 (仅在 GPU 可用时使用 cuda)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    # 使用 base 模型平衡速度与精度
    model = WhisperModel("base", device=device, compute_type="float16" if device == "cuda" else "int8")
    HAS_WHISPER = True
except ImportError:
    HAS_WHISPER = False

@router.post("/transcript")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    语音转文字接口
    利用 Faster-Whisper 在本地进行高效转写
    """
    if not file.content_type.startswith("audio/") and not file.filename.endswith(".webm"):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")
    
    # 保存临时文件
    temp_dir = "temp_audio"
    os.makedirs(temp_dir, exist_ok=True)
    file_id = str(uuid.uuid4())
    file_path = os.path.join(temp_dir, f"{file_id}_{file.filename}")
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        if HAS_WHISPER:
            # 真实转录过程
            # 增加 initial_prompt 引导模型输出简体中文，并指定语言为 zh
            segments, info = model.transcribe(
                file_path, 
                beam_size=5, 
                language="zh", 
                initial_prompt="以下是普通话面试回答，请输出简体中文："
            )
            text = "".join([segment.text for segment in segments])
            return {
                "text": text.strip(),
                "language": info.language,
                "probability": info.language_probability
            }
        else:
            return {
                "text": "【系统提示】后端尚未安装 faster-whisper。请安装以启用本地转写功能。",
                "status": "mock_mode"
            }
            
    except Exception as e:
        import traceback
        print(f"STT Error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"语音识别失败: {str(e)}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
