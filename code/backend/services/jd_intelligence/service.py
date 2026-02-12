from typing import List, Optional
import logging
from sqlalchemy.orm import Session
from core.config import settings
from openai import OpenAI
import instructor
from pydantic import BaseModel
from crud import job_description as crud_jd
from schemas.job_description import JobDescriptionCreate

logger = logging.getLogger(__name__)

class JDSmartResult(BaseModel):
    title: str
    description: str

class JDIntelligenceService:
    def __init__(self):
        if settings.ARK_API_KEY:
            self.client = OpenAI(
                base_url=settings.ARK_BASE_URL,
                api_key=settings.ARK_API_KEY
            )
            self.client = instructor.from_openai(self.client, mode=instructor.Mode.MD_JSON)
            self.model_name = settings.ARK_MODEL
        else:
            self.client = None
            logger.warning("ARK_API_KEY is not set for JDIntelligenceService.")

    async def smart_generate_jd(self, input_text: str) -> JDSmartResult:
        """
        AI 智能提取职位名称、优化格式或生成完整 JD
        """
        if not self.client:
            return JDSmartResult(
                title="AI 服务未配置",
                description="请在后端配置 ARK_API_KEY 后使用 AI 智能生成功能。"
            )

        system_prompt = """你是一个专业的 HR 招聘专家和资深文案策划。
你的任务是根据用户输入的片段、关键词或草稿，智能生成一份专业、标准且吸引人的职位描述（JD）。

具体要求：
1. 自动提取或归纳最准确的“职位名称”。
2. 将职位描述优化为 Markdown 格式，包含：【岗位职责】、【任职要求】、【加分项】（如有）、【福利待遇】（如能推测）。
3. 语言风格要专业且具有吸引力，符合现代互联网/专业职场标准。
4. 如果输入的内容很少，请基于职位常识进行合理的扩充和润色。
5. 必须返回包含 title 和 description 的结构化数据。"""

        user_prompt = f"""
### 用户输入的内容：
{input_text}

请基于以上内容生成一份完美的 JD。"""

        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                response_model=JDSmartResult,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.8,
            )
            return response
        except Exception as e:
            logger.error(f"Error in smart_generate_jd: {str(e)}")
            return JDSmartResult(
                title="生成失败",
                description=f"AI 处理过程中出现错误: {str(e)}"
            )

    async def create_smart_jd(self, db: Session, jd_text: str, category: str = "技术类") -> dict:
        """
        AI 解析并入库 JD（抽取自 tools.py）
        """
        # 1. AI 解析和润色
        result = await self.smart_generate_jd(jd_text)
        
        # 2. 尝试映射分类
        # 如果 Agent 传过来的分类是“研发”，我们将其映射为前端默认存在的“技术类”
        mapped_category = category
        if category == "研发":
            mapped_category = "技术类"
        
        # 3. 入库
        jd_create = JobDescriptionCreate(
            title=result.title,
            description=result.description,
            category=mapped_category,
            requirement_count=1
        )
        new_jd = crud_jd.create_job_description(db, jd_create)
        return {
            "status": "success",
            "message": f"职位【{new_jd.title}】已成功入库",
            "jd_id": new_jd.id,
            "title": new_jd.title
        }

jd_intelligence_service = JDIntelligenceService()
