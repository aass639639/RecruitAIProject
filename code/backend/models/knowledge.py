from sqlalchemy import Column, Integer, String, Text, JSON, DateTime
from database import Base
import datetime

class Knowledge(Base):
    __tablename__ = "knowledge"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    category = Column(String, index=True)
    content = Column(Text)
    tags = Column(JSON, default=[])
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
