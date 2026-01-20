from sqlalchemy.orm import Session
from models.user import User
from schemas.user import UserCreate

def get_user(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

def get_users(db: Session, skip: int = 0, limit: int = 100, role: str = None):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    return query.offset(skip).limit(limit).all()

def create_user(db: Session, user: UserCreate):
    db_user = User(**user.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
