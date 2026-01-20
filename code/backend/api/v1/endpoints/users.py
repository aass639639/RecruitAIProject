from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from crud import user as crud_user
from schemas import user as schema_user

router = APIRouter()

@router.get("/", response_model=List[schema_user.User])
def read_users(
    skip: int = 0,
    limit: int = 100,
    role: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud_user.get_users(db, skip=skip, limit=limit, role=role)

@router.post("/", response_model=schema_user.User)
def create_user(
    user: schema_user.UserCreate,
    db: Session = Depends(get_db)
):
    db_user = crud_user.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    return crud_user.create_user(db=db, user=user)

@router.post("/login", response_model=schema_user.User)
def login(username: str, db: Session = Depends(get_db)):
    user = crud_user.get_user_by_username(db, username=username)
    if not user:
        # For demo purposes, if user doesn't exist, maybe we create it or just fail
        raise HTTPException(status_code=404, detail="User not found")
    return user
