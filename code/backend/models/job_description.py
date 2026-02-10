from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base

class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    requirement_count = Column(Integer, default=0) # 期望招聘人数
    current_hired_count = Column(Integer, default=0) # 已入职人数
    is_active = Column(Boolean, default=True)
    category = Column(String, default="其他") # 职位分类：技术类、市场运营类、行政财务类、产品类等
    close_reason = Column(String, nullable=True) # 关闭理由
    created_at = Column(DateTime(timezone=True), server_default=func.now())
