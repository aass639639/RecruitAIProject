from fastapi import APIRouter
from api.v1.endpoints import resume, candidates, users, interviews, job_matcher, recruit_training

api_router = APIRouter()
api_router.include_router(resume.router, prefix="/resume", tags=["resume"])
api_router.include_router(candidates.router, prefix="/candidates", tags=["candidates"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(interviews.router, prefix="/interviews", tags=["interviews"])
api_router.include_router(job_matcher.router, prefix="/job-matcher", tags=["job-matcher"])
api_router.include_router(recruit_training.router, prefix="/recruit-training", tags=["recruit-training"])
