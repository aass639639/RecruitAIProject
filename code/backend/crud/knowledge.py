from sqlalchemy.orm import Session
from models.knowledge import Knowledge
from schemas.knowledge import KnowledgeItemCreate
import datetime

def get_knowledge(db: Session, knowledge_id: int):
    return db.query(Knowledge).filter(Knowledge.id == knowledge_id).first()

def get_knowledge_all(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Knowledge).offset(skip).limit(limit).all()

def create_knowledge(db: Session, knowledge: KnowledgeItemCreate):
    db_knowledge = Knowledge(
        title=knowledge.title,
        category=knowledge.category,
        content=knowledge.content,
        tags=knowledge.tags,
        updated_at=datetime.datetime.utcnow()
    )
    db.add(db_knowledge)
    db.commit()
    db.refresh(db_knowledge)
    return db_knowledge

def update_knowledge(db: Session, knowledge_id: int, knowledge_update: KnowledgeItemCreate):
    db_knowledge = get_knowledge(db, knowledge_id)
    if db_knowledge:
        db_knowledge.title = knowledge_update.title
        db_knowledge.category = knowledge_update.category
        db_knowledge.content = knowledge_update.content
        db_knowledge.tags = knowledge_update.tags
        db_knowledge.updated_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(db_knowledge)
    return db_knowledge

def delete_knowledge(db: Session, knowledge_id: int):
    db_knowledge = get_knowledge(db, knowledge_id)
    if db_knowledge:
        db.delete(db_knowledge)
        db.commit()
    return db_knowledge
