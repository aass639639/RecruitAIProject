from sqlalchemy import Column, Integer, String, Text, JSON, Float
from database import Base

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, index=True, nullable=True)
    phone = Column(String, nullable=True)
    education = Column(String, nullable=True)
    experience = Column(JSON, default=[])
    projects = Column(JSON, default=[]) # 项目经验
    skills = Column(JSON, default=[])
    summary = Column(Text, nullable=True)
    
    # AI 解析增强字段
    education_summary = Column(String, nullable=True)
    experience_list = Column(JSON, default=[])
    skill_tags = Column(JSON, default=[])
    parsing_score = Column(Integer, default=0)
    
    # 业务字段
    position = Column(String, index=True, nullable=True) # 职位分类
    years_of_experience = Column(Float, default=0) # 工作年限
    status = Column(String, default="none") # 状态: none (无), hired (已录用), rejected (已拒绝), resigned (已离职), interviewing (面试中)
    job_id = Column(Integer, nullable=True) # 关联的 JD ID
