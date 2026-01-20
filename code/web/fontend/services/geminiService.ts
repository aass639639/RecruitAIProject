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
   * 进行人岗匹配分析 (预留，后续后端实现)
   */
  async matchCandidate(candidate: Candidate, jd: string): Promise<{ score: number; analysis: string }> {
    try {
      const response = await apiClient.post('/match/analyze', { candidate, jd });
      return response.data;
    } catch (error) {
      console.error("匹配分析失败:", error);
      return { score: 0, analysis: "数据处理异常" };
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
    feedback?: string,
    exclude_questions?: string[],
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
      console.error("单题重新生成失败:", error);
      throw error;
    }
  },

  /**
   * 手动录入题目补充元数据
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
   * 根据最新题目列表刷新评分维度
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
  }
};
