from pydantic import BaseModel, Field
from typing import List, Optional

class InterviewQuestion(BaseModel):
    question: str = Field(..., description="面试问题内容")
    purpose: str = Field(..., description="考察目的")
    expected_answer: str = Field(..., description="期望回答")
    difficulty: str = Field(..., description="难度等级：基础/中等/困难")
    category: str = Field(..., description="考察维度：如技术能力、项目经验、沟通能力、逻辑思维等")
    source: str = Field(..., description="出题依据：根据JD的某项要求或简历的某个点")

class InterviewPlanGenerateRequest(BaseModel):
    candidate_id: int
    jd: str
    count: int = Field(5, description="生成题目总数")
    difficulty_distribution: Optional[dict] = Field(
        None, 
        description="难度分布，如 {'基础': 2, '中等': 2, '困难': 1}"
    )
    feedback: Optional[str] = Field(None, description="重新生成的反馈原因")
    exclude_questions: Optional[List[str]] = Field(None, description="需要排除的已有题目内容，避免重复")

class InterviewQuestionRegenerateRequest(BaseModel):
    candidate_id: int
    jd: str
    old_question: str = Field(..., description="要替换的原题目内容")
    feedback: Optional[str] = Field(None, description="针对这道题的修改要求")
    exclude_questions: Optional[List[str]] = Field(None, description="需要排除的所有已有题目内容")
    difficulty: Optional[str] = Field(None, description="指定难度等级")

class InterviewQuestionManualCompleteRequest(BaseModel):
    candidate_id: int
    jd: str
    question: str = Field(..., description="用户手动输入的问题内容")

class InterviewCriteriaRefreshRequest(BaseModel):
    candidate_id: int
    jd: str
    questions: List[str] = Field(..., description="当前的面试题目列表")

class InterviewCriteriaRefreshResponse(BaseModel):
    evaluation_criteria: List[str] = Field(..., description="更新后的评分维度/标准")

class InterviewPlanGenerateResponse(BaseModel):
    questions: List[InterviewQuestion]
    evaluation_criteria: List[str] = Field(..., description="评分维度/标准")

class InterviewQuestionPerformance(BaseModel):
    question: str
    answer: Optional[str] = None
    notes: Optional[str] = None
    score: Optional[int] = None

class InterviewEvaluationRequest(BaseModel):
    candidate_id: int
    jd: str
    performances: List[InterviewQuestionPerformance]
    overall_notes: Optional[str] = None

class InterviewEvaluationResponse(BaseModel):
    technical_evaluation: str = Field(..., description="技术层面评价")
    logical_evaluation: str = Field(..., description="逻辑表达评价")
    clarity_evaluation: str = Field(..., description="思路清晰度评价")
    comprehensive_suggestion: str = Field(..., description="综合建议")
