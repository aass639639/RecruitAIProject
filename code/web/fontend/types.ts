
export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  education: string;
  experience: any[];
  projects?: any[];
  skills: string[];
  summary: string;
  // AI 解析增强字段
  education_summary?: string;
  experience_list?: string[];
  skill_tags?: string[];
  parsing_score?: number;
  is_resume?: boolean;
  matchScore?: number;
  matchAnalysis?: string;
  position?: string; // 职位分类，如：研发、设计、算法、财务
  yearsOfExperience?: number; // 工作年限
  years_of_experience?: number; // 后端兼容字段
  status?: string; // 候选人状态: none, hired, rejected
}

export interface JobDescription {
  id: string;
  title: string;
  company: string;
  description: string;
  requirements: string[];
}

export interface Metric {
  label: string;
  value: string | number;
  change: string;
  icon: string;
  color: string;
}

export interface InterviewQuestion {
  question: string;
  purpose: string;
  expected_answer: string;
  difficulty: string;
  category: string;
  source: string;
  score?: number; // 面试官评分 (1-5)
  notes?: string; // 针对该题目的面试记录
}

export interface InterviewPlan {
  questions: InterviewQuestion[];
  evaluation_criteria: string[];
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'interviewer';
  department?: string;
}

export interface Interview {
  id: number;
  candidate_id: number;
  interviewer_id: number;
  admin_id: number;
  status: 'pending' | 'accepted' | 'preparing' | 'rejected' | 'in_progress' | 'completed' | 'cancelled';
  questions?: InterviewQuestion[];
  evaluation_criteria?: string[];
  notes?: string;
  hiring_decision?: string; // hire, pass, reject
  interview_time?: string;
  created_at: string;
  updated_at: string;
  candidate?: Candidate;
  interviewer?: User;
  admin?: User;
}
