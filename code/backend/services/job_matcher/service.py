from sqlalchemy.orm import Session
from typing import List, Optional, Any
import logging
from core.config import settings
from openai import OpenAI
import instructor
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class MatchResult(BaseModel):
    score: int
    analysis: str
    matching_points: List[str]
    mismatched_points: List[str]

class JobMatcherService:
    def __init__(self):
        if settings.ARK_API_KEY:
            self.client = OpenAI(
                base_url=settings.ARK_BASE_URL,
                api_key=settings.ARK_API_KEY
            )
            self.client = instructor.from_openai(self.client)
            self.model_name = settings.ARK_MODEL
        else:
            self.client = None
            logger.warning("ARK_API_KEY is not set for JobMatcherService.")

    async def analyze_match(self, candidate: Any, jd: str) -> MatchResult:
        """
        进行人岗匹配分析
        """
        if not self.client:
            return MatchResult(
                score=0, 
                analysis="AI 服务未配置，无法进行匹配分析。",
                matching_points=[],
                mismatched_points=[]
            )

        # 提取候选人关键信息
        candidate_info = ""
        if isinstance(candidate, dict):
            name = candidate.get("name", "未知")
            skills = ", ".join(candidate.get("skills", []))
            experience = "\n".join(candidate.get("experience", []))
            education = candidate.get("education", "未知")
            summary = candidate.get("summary", "")
            candidate_info = f"姓名：{name}\n教育：{education}\n技能：{skills}\n经历：{experience}\n总结：{summary}"
        else:
            candidate_info = str(candidate)

        system_prompt = """你是一个专业的 HR 招聘专家。
你的任务是分析候选人简历与岗位 JD 的匹配度。
你需要从以下几个维度进行评估：
1. 技能匹配：候选人掌握的技能是否符合 JD 的要求。
2. 经验匹配：候选人的工作经验是否符合 JD 的年限和行业背景要求。
3. 教育匹配：候选人的教育背景是否符合 JD 的要求。

请给出：
- 0-100 的匹配评分。
- 一段简洁、专业的综合分析报告（约 100 字）。
- 匹配点：列出 3-5 条候选人非常符合 JD 要求的地方。
- 不匹配点：列出 1-3 条候选人缺失或不完全符合 JD 要求的地方。"""

        user_prompt = f"""
### 岗位 JD：
{jd}

### 候选人简历信息：
{candidate_info}

请进行详细的匹配分析。"""

        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                response_model=MatchResult,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
            )
            return response
        except Exception as e:
            logger.error(f"Error in analyze_match: {str(e)}")
            return MatchResult(
                score=50, 
                analysis=f"分析过程中出现错误: {str(e)}",
                matching_points=[],
                mismatched_points=[]
            )

job_matcher_service = JobMatcherService()
