from fastapi import APIRouter
from api.v1.endpoints import resume, candidates, users, interviews, job_matcher, recruit_training, knowledge, job_descriptions, dashboard, agent, stt

api_router = APIRouter()
api_router.include_router(resume.router, prefix="/resume", tags=["resume"])
api_router.include_router(candidates.router, prefix="/candidates", tags=["candidates"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(interviews.router, prefix="/interviews", tags=["interviews"])
api_router.include_router(job_matcher.router, prefix="/match", tags=["match"])
api_router.include_router(recruit_training.router, prefix="/recruit-training", tags=["recruit-training"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
api_router.include_router(job_descriptions.router, prefix="/job-descriptions", tags=["job-descriptions"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(agent.router, prefix="/agent", tags=["agent"])
api_router.include_router(stt.router, prefix="/stt", tags=["stt"])
