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
            self.client = instructor.from_openai(self.client, mode=instructor.Mode.MD_JSON)
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
            skills = ", ".join(candidate.get("skills", [])) if isinstance(candidate.get("skills"), list) else str(candidate.get("skills", ""))
            experience = "\n".join(candidate.get("experience", [])) if isinstance(candidate.get("experience"), list) else str(candidate.get("experience", ""))
            education = candidate.get("education", "未知")
            summary = candidate.get("summary", "")
            candidate_info = f"姓名：{name}\n教育：{education}\n技能：{skills}\n经历：{experience}\n总结：{summary}"
        elif hasattr(candidate, "name"): # 处理 SQLAlchemy 模型对象
            name = getattr(candidate, "name", "未知")
            skills = ", ".join(candidate.skills) if isinstance(getattr(candidate, "skills"), list) else str(getattr(candidate, "skills", ""))
            experience = getattr(candidate, "experience", "")
            education = getattr(candidate, "education", "未知")
            summary = getattr(candidate, "summary", "")
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

    async def match_candidates(self, db: Session, candidates: List[Any], jd_description: str, limit: int = 5) -> List[dict]:
        """
        批量匹配候选人并过滤（抽取自原有逻辑）
        """
        import asyncio
        # 过滤掉已入职的候选人 (更加鲁棒的过滤逻辑，同时支持对象和字典)
        def is_hired(c):
            status = ""
            if isinstance(c, dict):
                status = c.get("status", "")
            else:
                status = getattr(c, "status", "")
            
            if status is None:
                return False
            return str(status).strip().lower() == "hired"

        active_candidates = [c for c in candidates if not is_hired(c)]
        
        # 调试打印
        print(f"DEBUG [match_candidates]: Total candidates: {len(candidates)}, Active after filtering: {len(active_candidates)}")
        if len(candidates) > len(active_candidates):
            filtered_names = [c.name if not isinstance(c, dict) else c.get("name") for c in candidates if is_hired(c)]
            print(f"DEBUG [match_candidates]: Filtered out (hired): {filtered_names}")
        
        if not active_candidates:
            return []
            
        tasks = [self.analyze_match(c, jd_description) for c in active_candidates]
        match_results = await asyncio.gather(*tasks)
        
        results = []
        for i, result in enumerate(match_results):
            results.append({
                "candidate_id": active_candidates[i].id,
                "candidate_name": active_candidates[i].name,
                "score": result.score,
                "analysis": result.analysis,
                "matching_points": result.matching_points,
                "mismatched_points": result.mismatched_points,
                "position": active_candidates[i].position,
                "status": getattr(active_candidates[i], "status", "none")
            })
        
        # 按分数排序
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

job_matcher_service = JobMatcherService()
