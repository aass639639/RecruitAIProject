from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"))
    interviewer_id = Column(Integer, ForeignKey("users.id"))
    admin_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="pending") # pending (待处理), accepted (已接受), preparing (准备中), rejected (已拒绝), in_progress (面试中), completed (已完成), cancelled (已取消)
    questions = Column(JSON, nullable=True) # 面试题目
    evaluation_criteria = Column(JSON, nullable=True) # 考察维度
    notes = Column(Text, nullable=True) # 面试笔记
    hiring_decision = Column(String, nullable=True) # 录用结论: hire (建议录用), pass (进入下一轮), reject (不建议录用)
    interview_time = Column(DateTime, nullable=True) # 面试时间
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    candidate = relationship("Candidate")
    interviewer = relationship("User", foreign_keys=[interviewer_id])
    admin = relationship("User", foreign_keys=[admin_id])
