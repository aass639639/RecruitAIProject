from typing import List, Optional, Type, Any
from pydantic import BaseModel, Field
from langchain_classic.tools import BaseTool
from sqlalchemy.orm import Session
from database import SessionLocal
from services.talent_pool.service import talent_pool_service
from services.job_matcher.service import job_matcher_service
from services.interview_assistant.service import InterviewAssistantService
from services.knowledge.service import knowledge_service
from schemas.interview_ai import InterviewPlanGenerateRequest
import asyncio
import json

from services.jd_intelligence.service import jd_intelligence_service

class SearchCandidatesInput(BaseModel):
    query: str = Field(description="搜索关键词，支持多个关键词用空格分隔（如 'Java 后端'），可匹配姓名、技能、职位分类或自我介绍")
    position: Optional[str] = Field(None, description="职位分类过滤。系统中现有的分类包括：研发、Data Scientist、IT支持、财务、生产运营、物流/供应链管理、MEP设计工程师等。")

class SearchCandidatesTool(BaseTool):
    name: str = "search_candidates"
    description: str = "在人才库中搜索候选人。支持多关键词搜索，优先搜索姓名、技能、职位和个人总结。"
    args_schema: Type[BaseModel] = SearchCandidatesInput

    def _run(self, query: str, position: Optional[str] = None):
        db = SessionLocal()
        try:
            # 直接调用 talent_pool_service 的搜索逻辑，它已经包含了排除 hired 状态的逻辑
            candidates = talent_pool_service.get_candidates(
                db, 
                search=query, 
                position=position,
                exclude_status="hired"
            )
            
            return [
                {
                    "id": c.id,
                    "name": c.name,
                    "position": c.position,
                    "skills": c.skills,
                    "experience": c.experience,
                    "summary": c.summary,
                    "status": getattr(c, "status", "")
                } for c in candidates
            ]
        finally:
            db.close()

class SearchJDInput(BaseModel):
    query: str = Field(description="搜索关键词，如职位名称、技能要求等")

class SearchJDTool(BaseTool):
    name: str = "search_job_descriptions"
    description: str = "在系统的职位库中搜索职位 (JD)。可以按职位名称、要求等关键词进行搜索。"
    args_schema: Type[BaseModel] = SearchJDInput

    def _run(self, query: str):
        db = SessionLocal()
        try:
            from crud import job_description as crud_jd
            # 搜索时返回所有匹配职位（包括已招满的），由 Agent 判断状态并回复
            jds = crud_jd.get_job_descriptions(db, search=query, only_active=False)
            return [
                {
                    "id": jd.id,
                    "title": jd.title,
                    "description": jd.description,
                    "category": jd.category,
                    "requirement_count": jd.requirement_count,
                    "current_hired_count": jd.current_hired_count,
                    "is_active": jd.is_active
                } for jd in jds
            ]
        finally:
            db.close()

class AnalyzeMatchInput(BaseModel):
    candidate_id: int = Field(description="候选人 ID")
    jd_content: str = Field(description="职位描述 (JD) 的文本内容")

class AnalyzeMatchTool(BaseTool):
    name: str = "analyze_candidate_match"
    description: str = "分析特定候选人与给定 JD 的匹配程度，返回评分和分析报告。"
    args_schema: Type[BaseModel] = AnalyzeMatchInput

    def _run(self, candidate_id: int, jd_content: str):
        # 同步运行异步方法的简易方案
        return asyncio.run(self._arun(candidate_id, jd_content))

    async def _arun(self, candidate_id: int, jd_content: str):
        db = SessionLocal()
        try:
            candidate = talent_pool_service.get_candidate(db, candidate_id)
            if not candidate:
                return "未找到该候选人"
            result = await job_matcher_service.analyze_match(candidate, jd_content)
            return result.model_dump()
        finally:
            db.close()

class GenerateInterviewPlanInput(BaseModel):
    candidate_id: int = Field(description="候选人 ID")
    jd_content: str = Field(description="职位描述 (JD) 的文本内容")
    count: int = Field(5, description="生成的题目数量")

class GenerateInterviewPlanTool(BaseTool):
    name: str = "generate_interview_questions"
    description: str = "为候选人针对特定岗位生成面试题目和评分维度。"
    args_schema: Type[BaseModel] = GenerateInterviewPlanInput

    def _run(self, candidate_id: int, jd_content: str, count: int = 5):
        return asyncio.run(self._arun(candidate_id, jd_content, count))

    async def _arun(self, candidate_id: int, jd_content: str, count: int = 5):
        db = SessionLocal()
        assistant = InterviewAssistantService()
        try:
            request = InterviewPlanGenerateRequest(
                candidate_id=candidate_id,
                jd=jd_content,
                count=count
            )
            result = await assistant.generate_interview_plan(db, request)
            return result.model_dump()
        finally:
            db.close()

class KnowledgeQueryInput(BaseModel):
    question: str = Field(description="用户想问的 HR 相关问题")

class KnowledgeQueryTool(BaseTool):
    name: str = "query_hr_knowledge"
    description: str = "查询公司内部 HR 知识库，回答关于规章制度、面试标准等问题。"
    args_schema: Type[BaseModel] = KnowledgeQueryInput

    def _run(self, question: str):
        return asyncio.run(self._arun(question))

    async def _arun(self, question: str):
        db = SessionLocal()
        try:
            result = await knowledge_service.chat_with_knowledge(db, question)
            return result.answer
        finally:
            db.close()

class GetJDListInput(BaseModel):
    pass

class GetJDListTool(BaseTool):
    name: str = "get_job_descriptions"
    description: str = "获取系统中已有的所有职位描述 (JD) 列表。返回职位的 ID、标题、具体描述、职位分类、招聘人数等信息。"
    args_schema: Type[BaseModel] = GetJDListInput

    def _run(self):
        db = SessionLocal()
        try:
            from crud import job_description as crud_jd
            # 获取列表时返回所有职位，由 Agent 筛选展示
            jds = crud_jd.get_job_descriptions(db, only_active=False)
            return [
                {
                    "id": jd.id,
                    "title": jd.title,
                    "description": jd.description,
                    "category": jd.category,
                    "requirement_count": jd.requirement_count,
                    "current_hired_count": jd.current_hired_count,
                    "is_active": jd.is_active
                } for jd in jds
            ]
        finally:
            db.close()

class MatchCandidatesForJobInput(BaseModel):
    jd_id: int = Field(description="职位 (JD) 的 ID")
    limit: int = Field(5, description="返回的最匹配候选人数量")

class MatchCandidatesForJobTool(BaseTool):
    name: str = "match_candidates_for_job"
    description: str = "为指定职位匹配人才库中的所有候选人，并返回匹配度最高的候选人列表。"
    args_schema: Type[BaseModel] = MatchCandidatesForJobInput

    def _run(self, jd_id: int, limit: int = 5):
        return asyncio.run(self._arun(jd_id, limit))

    async def _arun(self, jd_id: int, limit: int = 5):
        db = SessionLocal()
        try:
            from crud import job_description as crud_jd
            jd = crud_jd.get_job_description(db, jd_id)
            if not jd:
                return "未找到该职位"
            
            # 抽取后的复用逻辑：获取候选人并调用 JobMatcherService 进行统一匹配和过滤
            all_candidates = talent_pool_service.get_candidates(db, limit=100, exclude_status="hired")
            results = await job_matcher_service.match_candidates(db, all_candidates, jd.description, limit)
            
            if not results:
                return "人才库中暂无符合匹配条件的候选人（已过滤掉已入职人员）"
            
            return results
        finally:
            db.close()

class CreateJDInput(BaseModel):
    jd_text: str = Field(description="原始 JD 文本或描述")
    category: Optional[str] = Field("研发", description="职位分类")

class CreateJDTool(BaseTool):
    name: str = "create_job_description"
    description: str = "将一段 JD 文本解析并入库。如果你发现用户输入了一段 JD，请使用此工具。"
    args_schema: Type[BaseModel] = CreateJDInput

    def _run(self, jd_text: str, category: str = "研发"):
        return asyncio.run(self._arun(jd_text, category))

    async def _arun(self, jd_text: str, category: str = "研发"):
        db = SessionLocal()
        try:
            # 调用 JDIntelligenceService 中封装的逻辑
            res = await jd_intelligence_service.create_smart_jd(db, jd_text, category)
            if isinstance(res, dict):
                if res.get("status") == "error":
                    return f"职位入库失败：{res.get('message')}"
                
                # 返回卡片 JSON 格式
                card_data = {
                    "type": "job",
                    "props": {
                        "id": res.get("jd_id"),
                        "title": res.get("title"),
                        "category": category,
                        "requirement_count": 1,
                        "description": "职位已成功存入系统"
                    }
                }
                # 返回带有卡片标记的内容，由 Agent 整合进 Final Answer
                return f"```card\n{json.dumps(card_data, ensure_ascii=False)}\n```\n职位【{res.get('title')}】已成功入库。"
            return res
        except Exception as e:
            return f"职位入库过程中发生系统错误：{str(e)}"
        finally:
            db.close()

class CreateCandidateInput(BaseModel):
    resume_text: str = Field(description="简历文本内容")

class CreateCandidateTool(BaseTool):
    name: str = "create_candidate"
    description: str = "将一段简历文本解析并存入人才库。如果你发现用户输入了一段简历，请使用此工具。"
    args_schema: Type[BaseModel] = CreateCandidateInput

    def _run(self, resume_text: str):
        return asyncio.run(self._arun(resume_text))

    async def _arun(self, resume_text: str):
        db = SessionLocal()
        try:
            # 调用 talent_pool_service 中封装的逻辑
            res = await talent_pool_service.create_candidate_from_resume(db, resume_text)
            if isinstance(res, dict):
                if res.get("status") == "error":
                    return f"候选人入库失败：{res.get('message')}"
                
                # 返回卡片 JSON 格式
                card_data = {
                    "type": "candidate",
                    "props": {
                        "id": str(res.get("candidate_id")),
                        "name": res.get("name"),
                        "position": "新入库候选人",
                        "status": "active"
                    }
                }
                # 返回带有卡片标记的内容，由 Agent 整合进 Final Answer
                return f"```card\n{json.dumps(card_data, ensure_ascii=False)}\n```\n候选人【{res.get('name')}】已成功入库。"
            return res
        except Exception as e:
            return f"候选人入库过程中发生系统错误：{str(e)}"
        finally:
            db.close()

def get_all_tools():
    return [
        SearchCandidatesTool(),
        SearchJDTool(),
        AnalyzeMatchTool(),
        GenerateInterviewPlanTool(),
        KnowledgeQueryTool(),
        GetJDListTool(),
        MatchCandidatesForJobTool(),
        CreateJDTool(),
        CreateCandidateTool()
    ]
