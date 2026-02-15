
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
  raw_text?: string;
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
  status?: string; // 候选人状态: none, hired, rejected, resigned, interviewing
  job_id?: number; // 关联的 JD ID
}

export interface JobDescription {
  id: number;
  title: string;
  description: string;
  requirement_count: number;
  current_hired_count: number;
  is_active: boolean;
  category?: string;
  created_at?: string;
  close_reason?: string;
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
  answer?: string; // 候选人回答内容
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

export interface AiEvaluationResult {
  dimension: string;
  score: number;
  feedback: string;
}

export interface AiEvaluation {
  technical_evaluation: AiEvaluationResult;
  logical_evaluation: AiEvaluationResult;
  communication_evaluation?: AiEvaluationResult;
  clarity_evaluation?: string; // 兼容旧版
  comprehensive_suggestion: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // 使用 string 方便序列化存储
}

export interface Interview {
  id: number;
  candidate_id: number;
  interviewer_id: number;
  admin_id: number;
  job_id?: number;
  status: 'pending' | 'accepted' | 'preparing' | 'rejected' | 'in_progress' | 'completed' | 'cancelled' | 'pending_decision';
  questions?: InterviewQuestion[];
  evaluation_criteria?: string[];
  notes?: string;
  hiring_decision?: string; // hire, pass, reject
  ai_evaluation?: AiEvaluation;
  interview_time?: string;
  created_at: string;
  updated_at: string;
  candidate?: Candidate;
  interviewer?: User;
  admin?: User;
}
