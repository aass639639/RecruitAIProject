from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.interview import Interview
from models.candidate import Candidate
from models.user import User
from models.job_description import JobDescription
from schemas.dashboard import DashboardData, Notification
from datetime import datetime, timedelta
import pytz

router = APIRouter()

def get_time_diff_str(dt: datetime):
    if not dt:
        return "未知时间"
    
    # 确保 dt 是 offset-aware 的，或者都是 naive 的
    # 这里我们统一使用 UTC
    now = datetime.utcnow()
    diff = now - dt
    
    if diff.days > 0:
        return f"{diff.days}天前"
    hours = diff.seconds // 3600
    if hours > 0:
        return f"{hours}小时前"
    minutes = (diff.seconds % 3600) // 60
    if minutes > 0:
        return f"{minutes}分钟前"
    return "刚刚"

@router.get("/notifications", response_model=DashboardData)
def get_dashboard_notifications(
    user_id: int,
    db: Session = Depends(get_db)
):
    # 获取用户信息以确定角色
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    notifications = []
    
    if user.role == 'admin':
        # 管理员查看最近的面试动态
        # 获取最近更新的 10 条面试记录
        recent_interviews = db.query(Interview)\
            .order_by(Interview.updated_at.desc())\
            .limit(10)\
            .all()
            
        for interview in recent_interviews:
            # 获取关联信息
            candidate = db.query(Candidate).filter(Candidate.id == interview.candidate_id).first()
            interviewer = db.query(User).filter(User.id == interview.interviewer_id).first()
            job = db.query(JobDescription).filter(JobDescription.id == interview.job_id).first()
            
            candidate_name = candidate.name if candidate else "未知候选人"
            interviewer_name = interviewer.full_name if interviewer else "未知面试官"
            job_title = job.title if job else "未知岗位"
            
            content = ""
            n_type = ""
            
            if interview.status == 'completed':
                content = f"{interviewer_name} 完成了 [{job_title}] 岗位的候选人 [{candidate_name}] 的面试评价"
                n_type = "completed"
            elif interview.status == 'accepted':
                content = f"{interviewer_name} 接受了 [{job_title}] 岗位关于 [{candidate_name}] 的面试邀请"
                n_type = "accepted"
            elif interview.status == 'in_progress':
                content = f"{interviewer_name} 正在进行 [{job_title}] 岗位关于 [{candidate_name}] 的面试"
                n_type = "scheduled"
            elif interview.status == 'pending':
                content = f"新面试安排已发送给 {interviewer_name} ([{job_title}] - {candidate_name})"
                n_type = "pending"
            elif interview.status == 'rejected':
                content = f"{interviewer_name} 拒绝了 [{job_title}] 岗位的面试邀请"
                n_type = "rejected"
            elif interview.status == 'scheduled':
                content = f"已为 [{candidate_name}] 安排面试，面试官: {interviewer_name}"
                n_type = "scheduled"
            
            if content:
                notifications.append(Notification(
                    id=interview.id,
                    content=content,
                    time=get_time_diff_str(interview.updated_at),
                    type=n_type,
                    job_id=interview.job_id
                ))
    else:
        # 面试官查看自己的面试安排
        my_interviews = db.query(Interview)\
            .filter(Interview.interviewer_id == user_id)\
            .filter(Interview.status.in_(['pending', 'accepted', 'scheduled']))\
            .order_by(Interview.interview_time.asc())\
            .limit(10)\
            .all()
            
        for interview in my_interviews:
            candidate = db.query(Candidate).filter(Candidate.id == interview.candidate_id).first()
            job = db.query(JobDescription).filter(JobDescription.id == interview.job_id).first()
            
            candidate_name = candidate.name if candidate else "未知候选人"
            job_title = job.title if job else "未知岗位"
            
            time_str = ""
            if interview.interview_time:
                time_str = interview.interview_time.strftime("%m-%d %H:%M")
            else:
                time_str = "时间待定"
                
            content = f"为你安排了关于 [{job_title}] 岗位的候选人 [{candidate_name}] 的面试"
            
            notifications.append(Notification(
                id=interview.id,
                content=content,
                time=time_str,
                type="scheduled",
                job_id=interview.job_id
            ))
            
    return DashboardData(notifications=notifications)
