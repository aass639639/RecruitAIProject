import axios from 'axios';
import { Candidate, InterviewPlan } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const geminiService = {
  /**
   * 调用后端接口解析简历
   */
  async parseResume(text: string): Promise<Partial<Candidate>> {
    try {
      const response = await apiClient.post('/resume/parse', { text });
      return response.data;
    } catch (error) {
      console.error("解析简历失败:", error);
      throw error;
    }
  },

  /**
   * 上传简历文件并解析
   */
  async uploadResume(file: File): Promise<Partial<Candidate>> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post('/resume/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error("上传并解析简历失败:", error);
      throw error;
    }
  },

  /**
   * 进行人岗匹配分析
   */
  async matchCandidate(candidate: Candidate, jd: string): Promise<{ 
    score: number; 
    analysis: string;
    matching_points: string[];
    mismatched_points: string[];
  }> {
    try {
      const response = await apiClient.post('/match/analyze', { candidate, jd });
      return response.data;
    } catch (error) {
      console.error("匹配分析失败:", error);
      return { 
        score: 0, 
        analysis: "数据处理异常",
        matching_points: [],
        mismatched_points: []
      };
    }
  },

  /**
   * 生成面试计划
   */
  async generateInterviewPlan(
    candidate_id: number, 
    jd: string, 
    count: number = 5, 
    difficulty_distribution?: Record<string, number>,
    feedback?: string,
    exclude_questions?: string[]
  ): Promise<InterviewPlan> {
    try {
      const response = await apiClient.post('/interviews/generate', { 
        candidate_id, 
        jd, 
        count, 
        difficulty_distribution,
        feedback,
        exclude_questions
      });
      return response.data;
    } catch (error) {
      console.error("生成面试计划失败，详细错误:", error);
      throw error;
    }
  },

  /**
   * 单题重新生成
   */
  async regenerateSingleQuestion(
    candidate_id: number,
    jd: string,
    old_question: string,
    feedback: string,
    exclude_questions: string[],
    difficulty?: string
  ): Promise<any> {
    try {
      const response = await apiClient.post('/interviews/regenerate-question', {
        candidate_id,
        jd,
        old_question,
        feedback,
        exclude_questions,
        difficulty
      });
      return response.data;
    } catch (error) {
      console.error("重新生成题目失败:", error);
      throw error;
    }
  },

  /**
   * 手动题目补充完整元数据
   */
  async completeManualQuestion(
    candidate_id: number,
    jd: string,
    question: string
  ): Promise<any> {
    try {
      const response = await apiClient.post('/interviews/complete-manual-question', {
        candidate_id,
        jd,
        question
      });
      return response.data;
    } catch (error) {
      console.error("手动题目补充失败:", error);
      throw error;
    }
  },

  /**
   * 刷新评分维度
   */
  async refreshEvaluationCriteria(
    candidate_id: number,
    jd: string,
    questions: string[]
  ): Promise<string[]> {
    try {
      const response = await apiClient.post('/interviews/refresh-criteria', {
        candidate_id,
        jd,
        questions
      });
      return response.data.evaluation_criteria;
    } catch (error) {
      console.error("刷新评分维度失败:", error);
      throw error;
    }
  },

  /**
   * 获取所有知识库条目
   */
  async getKnowledgeBase(): Promise<any[]> {
    try {
      const response = await apiClient.get('/knowledge/');
      return response.data;
    } catch (error) {
      console.error("获取知识库失败:", error);
      return [];
    }
  },

  /**
   * 知识库问答 (RAG)
   */
  async chatWithKnowledge(question: string, session_id?: string): Promise<{ answer: string; source_ids: string[] }> {
    try {
      const response = await apiClient.post('/knowledge/chat', { question, session_id });
      return response.data;
    } catch (error) {
      console.error("知识库问答失败:", error);
      return { answer: "抱歉，系统暂时无法回答您的问题。", source_ids: [] };
    }
  },

  /**
   * 生成知识点建议
   */
  async getKnowledgeTip(title: string, content: string): Promise<string> {
    try {
      const response = await apiClient.post('/knowledge/tip', { title, content });
      return response.data.tip;
    } catch (error) {
      console.error("获取知识点建议失败:", error);
      throw error;
    }
  },

  /**
   * 与招聘 Agent 对话
   */
  async chatWithAgent(message: string, history: { role: string, content: string }[] = []): Promise<{ answer: string, status: string }> {
    try {
      const response = await apiClient.post('/agent/chat', { message, history });
      return response.data;
    } catch (error) {
      console.error("Agent 对话失败:", error);
      throw error;
    }
  },

  /**
   * 上传文件供 Agent 处理 (支持单文件或多文件)
   */
  async uploadFileToAgent(files: File | File[]): Promise<any> {
    try {
      const formData = new FormData();
      if (Array.isArray(files)) {
        files.forEach(file => formData.append('files', file));
      } else {
        formData.append('files', files);
      }
      
      const response = await apiClient.post('/agent/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error("Agent 上传文件失败:", error);
      throw error;
    }
  },

  /**
   * 录入新知识
   */
  async addKnowledge(knowledge: { title: string; category: string; content: string; tags: string[] }): Promise<any> {
    try {
      const response = await apiClient.post('/knowledge/', knowledge);
      return response.data;
    } catch (error) {
      console.error("录入新知识失败:", error);
      throw error;
    }
  },

  /**
   * 获取所有候选人
   */
  async getCandidates(): Promise<Candidate[]> {
    try {
      const response = await apiClient.get('/candidates/');
      return response.data;
    } catch (error) {
      console.error("获取候选人列表失败:", error);
      throw error;
    }
  },

  /**
   * 获取所有职位描述 (JD)
   */
  async getJobDescriptions(): Promise<any[]> {
    try {
      const response = await apiClient.get('/job-descriptions/');
      return response.data;
    } catch (error) {
      console.error("获取职位列表失败:", error);
      return [];
    }
  },

  /**
   * AI 智能生成或优化 JD
   */
  async smartGenerateJD(inputText: string): Promise<{ title: string; description: string }> {
    try {
      const response = await apiClient.post('/job-descriptions/smart-generate', { input_text: inputText });
      return response.data;
    } catch (error) {
      console.error("AI 智能生成 JD 失败:", error);
      throw error;
    }
  }
};
