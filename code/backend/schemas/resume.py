from pydantic import BaseModel, Field, EmailStr, validator
from typing import List, Optional, Any
from enum import Enum
import re

# ============ 引用自 preprocess/resume.py 的精细模型 ============

class EducationLevel(str, Enum):
    BACHELOR = "本科"
    MASTER = "硕士"
    PHD = "博士"
    ASSOCIATE = "专科"
    OTHER = "其他"

class Education(BaseModel):
    school_name: str = Field(..., description="学校全称，与原件完全一致")
    degree: EducationLevel = Field(..., description="学位类型")
    major: str = Field(..., description="专业名称，与原件完全一致")
    start_date: str = Field(..., description="开始时间，YYYY-MM格式")
    end_date: str = Field(..., description="结束时间，YYYY-MM格式或'Present'")
    gpa: Optional[float] = Field(None, description="GPA成绩，如未提及则为空")
    
    @validator("start_date", "end_date")
    def validate_date_format(cls, v):
        if v != "Present" and not re.match(r"^\d{4}-(0[1-9]|1[0-2])$", v):
            return v # 宽松处理，避免解析失败
        return v

class WorkExperience(BaseModel):
    company_name: str = Field(..., description="公司全称")
    position: str = Field(..., description="职位名称")
    start_date: str = Field(..., description="开始时间，YYYY-MM格式")
    end_date: str = Field(..., description="结束时间，YYYY-MM格式或'Present'")
    location: Optional[str] = Field(None, description="工作地点")
    description: List[str] = Field(default_factory=list, description="工作职责和成就，每条为完整句子")
    skills_used: List[str] = Field(default_factory=list, description="在该工作中使用的技能")
    
    @validator("description")
    def validate_description_length(cls, v):
        if len(v) > 10:
            return v[:10]
        return v

class Project(BaseModel):
    name: str = Field(..., description="项目名称")
    role: str = Field(..., description="担任角色")
    start_date: Optional[str] = Field(None, description="开始时间，YYYY-MM格式")
    end_date: Optional[str] = Field(None, description="结束时间，YYYY-MM格式或'Present'")
    description: List[str] = Field(default_factory=list, description="项目描述")
    technologies: List[str] = Field(default_factory=list, description="使用的技术栈")

class Skill(BaseModel):
    name: str = Field(..., description="技能名称")
    category: str = Field(..., description="技能类别，如'编程语言'、'框架'、'工具'等")
    proficiency: Optional[str] = Field(None, description="熟练程度：精通/熟练/了解")
    years_of_experience: Optional[float] = Field(None, description="使用年限")

class ContactInfo(BaseModel):
    phone: Optional[str] = Field(None, description="电话号码")
    email: Optional[EmailStr] = Field(None, description="邮箱地址")
    wechat: Optional[str] = Field(None, description="微信号")
    linkedin: Optional[str] = Field(None, description="LinkedIn链接")
    github: Optional[str] = Field(None, description="GitHub链接")

class ResumeParseRequest(BaseModel):
    text: str = Field(..., description="简历原始文本内容")

class ResumeParseResponse(BaseModel):
    # 状态与质量
    is_resume: bool = Field(True, description="输入内容是否为简历")
    parsing_score: int = Field(0, description="解析完整度评分 (0-100)")
    
    # 基本信息
    name: str = Field("未知", description="姓名")
    gender: Optional[str] = Field(None, description="性别")
    birth_date: Optional[str] = Field(None, description="出生日期，YYYY-MM-DD格式")
    
    # 联系信息
    contact: ContactInfo = Field(default_factory=ContactInfo)
    
    # 核心经历
    education: List[Education] = Field(default_factory=list, description="教育经历")
    work_experience: List[WorkExperience] = Field(default_factory=list, description="工作经历")
    projects: List[Project] = Field(default_factory=list, description="项目经历")
    
    # 技能
    skills: List[Skill] = Field(default_factory=list, description="技能列表")
    
    # 其他
    certifications: List[str] = Field(default_factory=list, description="证书列表")
    languages: List[str] = Field(default_factory=list, description="语言能力")
    self_introduction: Optional[str] = Field(None, description="自我评价/个人简介")
    
    # 额外字段 (用于前端 Candidate 接口兼容)
    summary: str = Field("", description="简历画像总结")
    
    # 辅助字段 (由 Service 填充)
    email: Optional[str] = None
    phone: Optional[str] = None
    education_summary: Optional[str] = Field(None)
    experience_list: List[str] = Field(default_factory=list)
    skill_tags: List[str] = Field(default_factory=list)
    years_of_experience: float = Field(0, description="工作年限")
    position: str = "研发"
    raw_text: Optional[str] = Field(None, description="简历原始文本")

    @validator("work_experience", "education")
    def sort_by_date_desc(cls, v):
        if not v:
            return v
        try:
            return sorted(v, key=lambda x: x.end_date if x.end_date != "Present" else "9999-12", reverse=True)
        except:
            return v
