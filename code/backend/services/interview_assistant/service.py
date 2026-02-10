import instructor
from openai import OpenAI
import json
from core.config import settings
from schemas.interview_ai import (
    InterviewPlanGenerateRequest, 
    InterviewPlanGenerateResponse,
    InterviewQuestion,
    InterviewQuestionRegenerateRequest,
    InterviewQuestionManualCompleteRequest,
    InterviewCriteriaRefreshRequest,
    InterviewCriteriaRefreshResponse,
    InterviewEvaluationRequest,
    InterviewEvaluationResponse
)
from sqlalchemy.orm import Session
from crud.candidate import get_candidate
import logging

logger = logging.getLogger(__name__)

class InterviewAssistantService:
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
            logger.warning("ARK_API_KEY is not set for InterviewAssistantService.")

    async def generate_interview_plan(
        self, db: Session, request: InterviewPlanGenerateRequest
    ) -> InterviewPlanGenerateResponse:
        if not self.client:
            raise ValueError("AI Client not configured.")

        # 获取候选人详情
        candidate = get_candidate(db, request.candidate_id)
        if not candidate:
            raise ValueError("Candidate not found")

        # 构造上下文
        candidate_info = f"""
姓名：{candidate.name}
职位分类：{candidate.position}
工作年限：{candidate.years_of_experience}年
教育背景：{candidate.education}
核心技能：{", ".join(candidate.skills) if candidate.skills else "未提及"}
简历总结：{candidate.summary}
工作经历：{json.dumps(candidate.experience, ensure_ascii=False)}
"""

        system_prompt = """你是一个资深的面试官助手。你的任务是根据提供的招聘 JD 和候选人简历，生成一套专业的面试题。
生成的题目需要满足以下要求：
1. **针对性**：题目必须结合 JD 的具体要求 and 候选人简历中的技能/项目经验。
2. **结构化**：每道题需要包含题目内容、考察目的、期望回答、难度等级、考察维度和出题依据。
3. **出题依据**：必须明确指出这道题是基于 JD 的哪项要求，还是基于候选人简历的哪个具体点出的。
4. **难度分布**：如果用户指定了难度分布，请严格遵守。
5. **反馈迭代**：如果提供了反馈原因（feedback），请在重新生成时针对性地改进，避免出现之前不符合要求的问题。
6. **评分维度**：提供 3-5 个针对该候选人和 JD 的核心评分维度。"""

        user_prompt = f"""
### 招聘 JD 内容：
{request.jd}

### 候选人简历信息：
{candidate_info}

### 生成要求：
- 题目总数：{request.count}
- 难度分布：{json.dumps(request.difficulty_distribution, ensure_ascii=False) if request.difficulty_distribution else "由你根据经验分配（建议包含基础、中等、困难）"}
- 重新生成反馈（如有）：{request.feedback if request.feedback else "无"}
- **必须排除的已有题目**：{json.dumps(request.exclude_questions, ensure_ascii=False) if request.exclude_questions else "无"}

请根据以上信息生成面试计划。"""

        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                response_model=InterviewPlanGenerateResponse,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
            )
            return response
        except Exception as e:
            logger.error(f"Error generating interview plan: {str(e)}")
            raise Exception(f"生成面试计划失败: {str(e)}")

    async def regenerate_single_question(
        self, db: Session, request: InterviewQuestionRegenerateRequest
    ) -> InterviewQuestion:
        if not self.client:
            raise ValueError("AI Client not configured.")

        candidate = get_candidate(db, request.candidate_id)
        if not candidate:
            raise ValueError("Candidate not found")

        candidate_info = f"""
姓名：{candidate.name}
职位分类：{candidate.position}
核心技能：{", ".join(candidate.skills) if candidate.skills else "未提及"}
简历总结：{candidate.summary}
"""

        system_prompt = """你是一个资深的面试官助手。你的任务是替换面试计划中的某一道不合适的题目。
要求：
1. **替换性**：生成的新题目必须能够替换原题目，且不能与已有的其他题目重复。
2. **针对性**：根据用户提供的具体反馈（feedback）来改进这道题。
3. **结构化**：必须包含题目内容、考察目的、期望回答、难度等级、考察维度和出题依据。
4. **禁止重复**：严禁生成与 `exclude_questions` 列表中相似或相同的题目。"""

        user_prompt = f"""
### 候选人信息：
{candidate_info}

### 招聘 JD 内容：
{request.jd}

### 待替换的原题目：
{request.old_question}

### 用户修改要求：
{request.feedback if request.feedback else "这道题不合适，请重新生成一道"}

### 期望难度：
{request.difficulty if request.difficulty else "与原题一致"}

### 必须排除的已有题目（严禁重复）：
{json.dumps(request.exclude_questions, ensure_ascii=False) if request.exclude_questions else "无"}

请生成一道新的面试题。"""

        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                response_model=InterviewQuestion,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.8,
            )
            return response
        except Exception as e:
            logger.error(f"Error regenerating single question: {str(e)}")
            raise Exception(f"单题重新生成失败: {str(e)}")

    async def complete_manual_question(
        self, db: Session, request: InterviewQuestionManualCompleteRequest
    ) -> InterviewQuestion:
        if not self.client:
            raise ValueError("AI Client not configured.")

        candidate = get_candidate(db, request.candidate_id)
        if not candidate:
            raise ValueError("Candidate not found")

        candidate_info = f"""
姓名：{candidate.name}
职位分类：{candidate.position}
核心技能：{", ".join(candidate.skills) if candidate.skills else "未提及"}
简历总结：{candidate.summary}
"""

        system_prompt = """你是一个资深的面试官助手。用户手动输入了一个面试问题，你的任务是为这个题目补充完整的元数据。
要求：
1. **结构化**：必须包含题目内容（直接使用用户输入的）、考察目的、期望回答、难度等级、考察维度。
2. **出题依据**：此字段固定为 "用户手动调整"。
3. **针对性**：补充的考察目的和期望回答必须结合候选人的背景和 JD 的要求。"""

        user_prompt = f"""
### 候选人信息：
{candidate_info}

### 招聘 JD 内容：
{request.jd}

### 用户输入的题目内容：
{request.question}

请根据以上信息，为该题目补充考察目的、期望回答、难度等级、考察维度。"""

        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                response_model=InterviewQuestion,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
            )
            # 强制设置 source 为 "用户手动调整"
            response.source = "用户手动调整"
            return response
        except Exception as e:
            logger.error(f"Error completing manual question: {str(e)}")
            raise Exception(f"手动题目补充失败: {str(e)}")

    async def refresh_evaluation_criteria(
        self, db: Session, request: InterviewCriteriaRefreshRequest
    ) -> InterviewCriteriaRefreshResponse:
        if not self.client:
            raise ValueError("AI Client not configured.")

        candidate = get_candidate(db, request.candidate_id)
        if not candidate:
            raise ValueError("Candidate not found")

        candidate_info = f"""
姓名：{candidate.name}
职位分类：{candidate.position}
核心技能：{", ".join(candidate.skills) if candidate.skills else "未提及"}
"""

        system_prompt = """你是一个资深的面试官助手。面试题目已经发生了调整，你的任务是根据最新的题目列表、候选人背景和 JD 要求，重新提取和优化面试的评分维度（evaluation_criteria）。
要求：
1. **关联性**：评分维度必须能够覆盖所有面试题目的核心考点。
2. **专业性**：维度描述要清晰、具体，方便面试官在面试过程中进行打分。
3. **精简**：提供 3-5 个核心评分维度。"""

        user_prompt = f"""
### 候选人信息：
{candidate_info}

### 招聘 JD 内容：
{request.jd}

### 最新的面试题目列表：
{json.dumps(request.questions, ensure_ascii=False, indent=2)}

请根据以上信息，重新生成 3-5 个核心评分维度。"""

        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                response_model=InterviewCriteriaRefreshResponse,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
            )
            return response
        except Exception as e:
            logger.error(f"Error refreshing evaluation criteria: {str(e)}")
            raise Exception(f"评分维度更新失败: {str(e)}")

    async def evaluate_interview(
        self, db: Session, request: InterviewEvaluationRequest
    ) -> InterviewEvaluationResponse:
        if not self.client:
            raise ValueError("AI Client not configured.")

        candidate = get_candidate(db, request.candidate_id)
        if not candidate:
            raise ValueError("Candidate not found")

        # 构造面试表现上下文
        performances_text = ""
        for i, p in enumerate(request.performances):
            performances_text += f"""
第 {i+1} 题：{p.question}
候选人回答：{p.answer if p.answer else "未记录"}
面试官记录：{p.notes if p.notes else "未记录"}
评分：{p.score if p.score else "未评分"}
---"""

        system_prompt = """你是一个资深的招聘专家和面试评估官。你的任务是根据面试过程中的问答记录、面试官的笔记以及招聘 JD，对候选人进行全面、客观的评价。
评价需要涵盖以下几个维度：
1. **技术层面**：候选人对专业知识的掌握程度，解决问题的能力。
2. **逻辑表达**：候选人回答问题是否有条理，是否能够清晰地表达自己的观点。
3. **思路清晰度**：在面对复杂问题或压力面试时，候选人的思考过程是否清晰，是否有系统性的思维。
4. **综合建议**：这是最重要的部分。请严格按照以下格式输出：
    - **面试结论**：[建议录用 / 建议进入下一轮 / 不建议录用]
    - **核心优势**：列出 2-3 点候选人的突出优点。
    - **待提升点**：列出 1-2 点候选人需要改进或在后续面试中重点考察的点。
    - **总结陈述**：一句话概括候选人的整体表现。

要求：
- 评价要客观、专业，避免笼统的描述。
- 综合建议必须先给出结论，再列出优缺点。
- 字数适中，结构清晰。"""

        user_prompt = f"""
### 招聘 JD 内容：
{request.jd}

### 候选人信息：
姓名：{candidate.name}
职位：{candidate.position}

### 面试表现记录：
{performances_text}

### 面试官综合总结：
{request.overall_notes if request.overall_notes else "无"}

请根据以上信息，给出详细的面试评价。"""

        try:
            print(f"Evaluating interview for candidate {request.candidate_id}")
            response = self.client.chat.completions.create(
                model=self.model_name,
                response_model=InterviewEvaluationResponse,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
            )
            return response
        except Exception as e:
            logger.error(f"Error evaluating interview: {str(e)}")
            raise Exception(f"面试评价生成失败: {str(e)}")

interview_assistant_service = InterviewAssistantService()
