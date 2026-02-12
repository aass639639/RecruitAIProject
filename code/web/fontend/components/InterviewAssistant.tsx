import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import { geminiService } from '../services/geminiService';
import { Candidate, InterviewPlan } from '../types';

interface InterviewAssistantProps {
  candidate: Candidate | null;
  interviewId?: number | null;
  onFinish?: () => void;
}

const InterviewAssistant: React.FC<InterviewAssistantProps> = ({ candidate, interviewId: propInterviewId, onFinish }) => {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<InterviewPlan | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [notes, setNotes] = useState('');
  const [hiringDecision, setHiringDecision] = useState<string>(''); // hire, pass, reject
  const [interviewId, setInterviewId] = useState<number | null>(propInterviewId || null);

  // 当 propInterviewId 变化时同步更新
  useEffect(() => {
    if (propInterviewId) {
      setInterviewId(propInterviewId);
    }
  }, [propInterviewId]);
  
  // 自动保存笔记和评分
  useEffect(() => {
    const saveProgress = async () => {
      if (interviewId !== null) {
        try {
          await axios.put(`http://localhost:8000/api/v1/interviews/${interviewId}`, { 
            notes: notes,
            questions: plan?.questions,
            hiring_decision: hiringDecision
          });
          console.log("Interview progress auto-saved");
        } catch (error) {
          console.error("Failed to auto-save progress:", error);
        }
      }
    };

    const timeoutId = setTimeout(saveProgress, 1000);
    return () => clearTimeout(timeoutId);
  }, [notes, plan, hiringDecision, interviewId]);
  
  // 配置状态
  const [jd, setJd] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [difficultyDist, setDifficultyDist] = useState({ '基础': 2, '中等': 2, '困难': 1 });
  const [feedback, setFeedback] = useState('');
  const [showConfig, setShowConfig] = useState(true);
  const [singleQuestionFeedback, setSingleQuestionFeedback] = useState('');
  const [isRegeneratingSingle, setIsRegeneratingSingle] = useState(false);
  const [usedQuestions, setUsedQuestions] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('accepted');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [manualQuestionText, setManualQuestionText] = useState('');
  const [isCompletingManual, setIsCompletingManual] = useState(false);
  const [isRefreshingCriteria, setIsRefreshingCriteria] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // 当 plan 变化时更新已使用题目列表
  useEffect(() => {
    if (plan?.questions) {
      const questions = plan.questions.map(q => q.question);
      setUsedQuestions(prev => {
        const combined = [...new Set([...prev, ...questions])];
        return combined;
      });
    }
  }, [plan]);

  // 调试日志
  useEffect(() => {
    console.log("InterviewAssistant state:", { showConfig, plan: !!plan, loading });
  }, [showConfig, plan, loading]);

  const fetchInterview = async (id?: number | null) => {
    const targetId = id || interviewId;
    if (!targetId && !candidate) return;

    try {
      let currentInterview;
      if (targetId) {
        const response = await axios.get(`http://localhost:8000/api/v1/interviews/${targetId}`);
        currentInterview = response.data;
      } else if (candidate) {
        // 获取该候选人的所有活跃面试（待面试、已接受、准备中、进行中、待评价）
        const response = await axios.get(`http://localhost:8000/api/v1/interviews/?candidate_id=${candidate.id}`);
        const activeInterviews = response.data.filter((i: any) => 
          ['pending', 'accepted', 'preparing', 'in_progress', 'pending_decision'].includes(i.status)
        );
        if (activeInterviews.length > 0) {
          currentInterview = activeInterviews[0];
        }
      }

      if (currentInterview) {
        setInterviewId(currentInterview.id);
        setStatus(currentInterview.status);
        
        // 如果有关联的 JD，获取 JD 详情用于智能出题
        const jobId = currentInterview.candidate?.job_id;
        if (jobId) {
          try {
            const jdResponse = await axios.get(`http://localhost:8000/api/v1/job-descriptions/${jobId}`);
            if (jdResponse.data && jdResponse.data.description) {
              setJd(jdResponse.data.description);
              console.log("Loaded JD description for question generation:", jdResponse.data.title);
            }
          } catch (jdError) {
            console.error("Failed to fetch JD description:", jdError);
          }
        } else if (candidate?.job_id) {
          // 兜底逻辑：如果面试记录里没带 candidate，尝试从 props 里的 candidate 获取
          try {
            const jdResponse = await axios.get(`http://localhost:8000/api/v1/job-descriptions/${candidate.job_id}`);
            if (jdResponse.data && jdResponse.data.description) {
              setJd(jdResponse.data.description);
            }
          } catch (jdError) {
            console.error("Failed to fetch JD description from candidate prop:", jdError);
          }
        }
        
        // 如果已经有题目，加载它们
        if (currentInterview.questions && currentInterview.questions.length > 0) {
          setPlan({
            questions: currentInterview.questions,
            evaluation_criteria: currentInterview.evaluation_criteria || []
          });
          setNotes(currentInterview.notes || '');
          setHiringDecision(currentInterview.hiring_decision || '');
          setEvaluationResult(currentInterview.ai_evaluation || null);
          
          // 自动计算当前进度
          // 找到第一个没有评分且没有笔记的问题索引
          const firstUnfinishedIndex = currentInterview.questions.findIndex((q: any) => !q.score && !q.notes);
          if (firstUnfinishedIndex !== -1) {
            setCurrentStep(firstUnfinishedIndex);
          } else if (currentInterview.hiring_decision || currentInterview.notes) {
            // 如果所有题都答了，且有了结论或总笔记，则跳到最后一步
            setCurrentStep(currentInterview.questions.length);
          } else {
            // 如果题都答了但没结论，也跳到最后一步
            setCurrentStep(currentInterview.questions.length);
          }

          setShowConfig(false);
          console.log("Loaded existing interview plan and restored step to:", firstUnfinishedIndex === -1 ? currentInterview.questions.length : firstUnfinishedIndex);
        }
      }
    } catch (error) {
      console.error('Error fetching/updating interview:', error);
    }
  };

  const handleFinishInterview = async () => {
    if (!interviewId) {
      alert('未找到活跃面试记录，无法完成');
      return;
    }
    
    // 根据是否填写了录用结论来决定最终状态
    const finalStatus = hiringDecision ? 'completed' : 'pending_decision';
    const statusText = hiringDecision ? '面试已完成' : '面试已结束（待填写结论）';

    try {
      await axios.put(`http://localhost:8000/api/v1/interviews/${interviewId}`, { 
        status: finalStatus,
        questions: plan?.questions,
        evaluation_criteria: plan?.evaluation_criteria,
        notes: notes,
        hiring_decision: hiringDecision,
        ai_evaluation: evaluationResult
      });

      // 面试结束，将候选人状态设回 none，以便管理员进行录用/拒绝操作
      if (candidate?.id) {
        await axios.put(`http://localhost:8000/api/v1/candidates/${candidate.id}`, { status: 'none' });
      }

      setStatus(finalStatus);
      alert(statusText);
      if (onFinish) {
        onFinish();
      } else {
        window.location.reload(); 
      }
    } catch (error) {
      console.error('Error finishing interview:', error);
      alert('操作失败');
    }
  };

  const handleStartPreparing = async () => {
    if (!interviewId) return;
    try {
      await axios.put(`http://localhost:8000/api/v1/interviews/${interviewId}`, { status: 'preparing' });
      setStatus('preparing');
      setShowConfig(true);
    } catch (error) {
      console.error('Failed to update status to preparing:', error);
    }
  };

  const handleStartInterview = async () => {
    if (!interviewId) return;
    try {
      const now = new Date();
      await axios.put(`http://localhost:8000/api/v1/interviews/${interviewId}`, { 
        status: 'in_progress',
        interview_time: now.toISOString()
      });
      
      // 同步更新候选人状态为面试中
      if (candidate?.id) {
        await axios.put(`http://localhost:8000/api/v1/candidates/${candidate.id}`, { status: 'interviewing' });
      }
      
      setStatus('in_progress');
      setShowConfig(false);
      setCurrentStep(0); // 开始面试时自动跳转到第一题
    } catch (error) {
      console.error('Failed to update status to in_progress:', error);
    }
  };

  const handleDifficultyChange = (key: string, value: number) => {
    const newDist = { ...difficultyDist, [key]: value };
    setDifficultyDist(newDist);
    // 自动同步总数
    const newTotal = Object.values(newDist).reduce((sum, val) => (sum as number) + (val as number), 0);
    setQuestionCount(newTotal as number);
  };

  const handleQuestionCountChange = (value: number) => {
    setQuestionCount(value);
    // 简单平分难度（向上取整给基础，剩下的给中等，再剩下给困难）
    const base = Math.ceil(value / 3);
    const medium = Math.ceil((value - base) / 2);
    const hard = value - base - medium;
    setDifficultyDist({ '基础': base, '中等': medium, '困难': hard });
  };

  const generatePlan = async (isRegenerate: boolean = false) => {
    if (!candidate) return;
    setLoading(true);
    try {
      const result = await geminiService.generateInterviewPlan(
        Number(candidate.id), 
        jd, 
        questionCount, 
        difficultyDist,
        isRegenerate ? feedback : undefined,
        usedQuestions
      );
      setPlan(result);
      setUsedQuestions(result.questions.map(q => q.question));
      setShowConfig(false);
      setCurrentStep(0);
      if (isRegenerate) setFeedback('');
      
      // 确保有 interviewId 再保存
      let currentInterviewId = interviewId;
      if (!currentInterviewId) {
        console.log("No interviewId found, attempting to fetch...");
        const response = await axios.get(`http://localhost:8000/api/v1/interviews/?candidate_id=${candidate.id}`);
        const activeInterviews = response.data.filter((i: any) => 
          ['pending', 'accepted', 'preparing', 'in_progress'].includes(i.status)
        );
        if (activeInterviews.length > 0) {
          currentInterviewId = activeInterviews[0].id;
          setInterviewId(currentInterviewId);
        }
      }

      if (currentInterviewId) {
        console.log(`Saving generated plan to interview ${currentInterviewId}`);
        await axios.put(`http://localhost:8000/api/v1/interviews/${currentInterviewId}`, { 
          questions: result.questions,
          evaluation_criteria: result.evaluation_criteria,
          status: 'preparing' // 生成题目后自动标记为准备中
        });
        setStatus('preparing');
        console.log("Interview plan saved to database");
      } else {
        console.warn("Could not save interview plan: No active interview found for candidate");
      }
    } catch (e) {
      console.error(e);
      alert('生成失败，请检查后端服务或 AI 配置');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateSingleQuestion = async (index: number) => {
    if (!candidate || !plan) return;
    
    setIsRegeneratingSingle(true);
    try {
      const oldQuestion = plan.questions[index];
      const newQuestion = await geminiService.regenerateSingleQuestion(
        Number(candidate.id),
        jd,
        oldQuestion.question,
        singleQuestionFeedback,
        usedQuestions,
        oldQuestion.difficulty
      );

      const newQuestions = [...plan.questions];
      newQuestions[index] = newQuestion;
      setPlan(prev => prev ? { ...prev, questions: newQuestions } : null);
      setSingleQuestionFeedback('');
      
      // 更新已使用题目列表
      setUsedQuestions(newQuestions.map(q => q.question));
      
      // 同步到数据库
      if (interviewId) {
        await axios.put(`http://localhost:8000/api/v1/interviews/${interviewId}`, { 
          questions: newQuestions
        });
      }
      // 重新生成评分维度以匹配新题目
      await handleRefreshCriteria(newQuestions);
    } catch (e) {
      console.error(e);
      alert('单题生成失败，请重试');
    } finally {
      setIsRegeneratingSingle(false);
    }
  };

  const handleCompleteManualQuestion = async (index: number) => {
    if (!candidate || !manualQuestionText) return;
    
    setIsCompletingManual(true);
    try {
      const completedQuestion = await geminiService.completeManualQuestion(
        Number(candidate.id),
        jd,
        manualQuestionText
      );

      if (plan) {
        const newQuestions = [...plan.questions];
        newQuestions[index] = completedQuestion;
        setPlan(prev => prev ? { ...prev, questions: newQuestions } : null);
        setEditingIndex(null);
        setManualQuestionText('');
        
        // 更新已使用题目列表
        setUsedQuestions(newQuestions.map(q => q.question));
        
        // 同步到数据库
        if (interviewId) {
          await axios.put(`http://localhost:8000/api/v1/interviews/${interviewId}`, { 
            questions: newQuestions
          });
        }
        // 重新生成评分维度以匹配新题目
        await handleRefreshCriteria(newQuestions);
      }
    } catch (e) {
      console.error(e);
      alert('手动题目补充失败，请重试');
    } finally {
      setIsCompletingManual(false);
    }
  };

  const handleRefreshCriteria = async (currentQuestions?: any[]) => {
    const questionsToUse = currentQuestions || plan?.questions;
    if (!candidate || !questionsToUse || !questionsToUse.length) return;
    
    setIsRefreshingCriteria(true);
    try {
      const questionTexts = questionsToUse.map(q => q.question);
      const newCriteria = await geminiService.refreshEvaluationCriteria(
        Number(candidate.id),
        jd,
        questionTexts
      );
      
      setPlan(prev => prev ? { ...prev, evaluation_criteria: newCriteria } : null);
      
      // 同步到数据库
      if (interviewId) {
        await axios.put(`http://localhost:8000/api/v1/interviews/${interviewId}`, { 
          evaluation_criteria: newCriteria
        });
      }
    } catch (e) {
      console.error(e);
      alert('评分维度刷新失败，请重试');
    } finally {
      setIsRefreshingCriteria(false);
    }
  };

  const handleShowConfig = () => {
    console.log("Opening configuration panel. Current showConfig:", showConfig);
    setShowConfig(true);
  };

  useEffect(() => {
    if (candidate || propInterviewId) {
      fetchInterview(propInterviewId);
    }
    
    // 初始化语音识别
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'zh-CN';
      setRecognition(recognitionInstance);
    }
  }, [candidate, propInterviewId]);

  const handleQuestionNoteChange = (index: number, value: string) => {
    if (!plan) return;
    const newQuestions = [...plan.questions];
    newQuestions[index] = { ...newQuestions[index], notes: value };
    setPlan({ ...plan, questions: newQuestions });
  };

  const handleQuestionAnswerChange = (index: number, value: string) => {
    if (!plan) return;
    const newQuestions = [...plan.questions];
    newQuestions[index] = { ...newQuestions[index], answer: value };
    setPlan({ ...plan, questions: newQuestions });
  };

  const startRecording = (index: number) => {
    if (!recognition) {
      alert('您的浏览器不支持语音识别功能');
      return;
    }

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        const currentAnswer = plan?.questions[index].answer || '';
        handleQuestionAnswerChange(index, currentAnswer + finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recognition) {
      recognition.stop();
      setIsRecording(false);
    }
  };

  const handleEvaluateInterview = async () => {
    if (!interviewId || !plan) return;
    
    setIsEvaluating(true);
    try {
      const response = await axios.post(`http://localhost:8000/api/v1/interviews/evaluate`, {
        candidate_id: Number(candidate?.id),
        jd: jd,
        performances: plan.questions.map(q => ({
          question: q.question,
          answer: q.answer,
          notes: q.notes,
          score: q.score
        })),
        overall_notes: notes
      });
      setEvaluationResult(response.data);
      
      // 同步 AI 评价结果到面试记录
      await axios.put(`http://localhost:8000/api/v1/interviews/${interviewId}`, {
        ai_evaluation: response.data
      });
    } catch (error) {
      console.error('Failed to get AI evaluation:', error);
      alert('AI 评价生成失败');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleQuestionScoreChange = (index: number, score: number) => {
    if (!plan) return;
    const newQuestions = [...plan.questions];
    newQuestions[index] = { ...newQuestions[index], score: score };
    setPlan({ ...plan, questions: newQuestions });
  };

  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-white rounded-3xl border border-dashed border-slate-300">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
          <i className="fas fa-user-plus text-slate-300 text-3xl"></i>
        </div>
        <h3 className="text-lg font-bold text-slate-600">请先选择一个候选人</h3>
        <p className="text-slate-400 text-sm mt-2">您可以从“人岗匹配”或“人才库”中发起面试</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center relative z-20">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">AI 面试工作台</h1>
            <p className="text-sm text-slate-500 mt-1">正在为 <span className="text-indigo-600 font-bold">{candidate.name}</span> 进行面试准备</p>
          </div>
          <div className="flex items-center px-3 py-1 bg-slate-100 rounded-full border border-slate-200">
            <div className={`w-2 h-2 rounded-full mr-2 ${
              status === 'in_progress' ? 'bg-green-500 animate-pulse' :
              status === 'preparing' ? 'bg-amber-500' :
              status === 'accepted' ? 'bg-blue-500' :
              status === 'pending_decision' ? 'bg-purple-500' :
              status === 'completed' ? 'bg-slate-400' : 'bg-slate-300'
            }`}></div>
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
              {status === 'accepted' ? '面试已接受' :
               status === 'preparing' ? '面试准备中' :
               status === 'in_progress' ? '正在面试中' :
               status === 'pending_decision' ? '面试待评价' :
               status === 'completed' ? '面试已结束' : '待处理'}
            </span>
          </div>
        </div>
        <div className="flex space-x-3">
          {status !== 'completed' && status !== 'in_progress' && (
            <button 
              onClick={handleShowConfig}
              className={`px-4 py-2 border rounded-xl text-sm font-bold transition-all flex items-center shadow-sm ${
                showConfig 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-inner' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <i className="fas fa-cog mr-2"></i> 调整配置
            </button>
          )}
          {status === 'in_progress' && (
            <button 
              onClick={handleFinishInterview}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              完成面试
            </button>
          )}
        </div>
      </header>

      {showConfig ? (
        <div 
          className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300 relative z-10"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center">
              <i className="fas fa-magic text-indigo-500 mr-3"></i> 智能出题配置
            </h3>
            {plan && (
              <button 
                onClick={() => setShowConfig(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                title="返回面试"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">招聘岗位 JD</label>
              <textarea 
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                className="w-full h-32 p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm"
                placeholder="请输入该职位的 JD 描述，AI 将基于此出题..."
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">题目总数</label>
                <input 
                  type="number"
                  value={questionCount}
                  onChange={(e) => handleQuestionCountChange(Number(e.target.value))}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-bold"
                  min="1" max="15"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">难度分布 (基础/中等/困难)</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['基础', '中等', '困难'] as const).map((level) => (
                    <div key={level} className="relative">
                      <input 
                        type="number"
                        value={difficultyDist[level]}
                        onChange={(e) => handleDifficultyChange(level, Number(e.target.value))}
                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-bold text-center"
                        min="0"
                      />
                      <span className="absolute -top-1.5 left-2 px-1 bg-white text-[8px] font-black text-slate-400 uppercase">{level}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {plan && (
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-black text-rose-400 uppercase tracking-widest mb-2">不符合要求？告诉 AI 原因</label>
                <textarea 
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full h-20 p-4 border border-rose-100 bg-rose-50/30 rounded-2xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all text-sm"
                  placeholder="例如：题目太简单了、没有考察到分布式架构相关知识、更侧重项目管理能力..."
                />
              </div>
            )}

            <button 
              onClick={() => generatePlan(!!plan)}
              disabled={loading}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <><i className="fas fa-circle-notch fa-spin mr-3"></i> AI 正在思考中...</>
              ) : (
                plan ? "重新生成题目" : "开始智能出题"
              )}
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-3xl border border-slate-200">
          <i className="fas fa-circle-notch fa-spin text-3xl text-indigo-500 mb-4"></i>
          <p className="text-slate-500 font-bold">AI 正在根据简历画像定制面试题目...</p>
        </div>
      ) : plan && plan.questions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-250px)]">
          {/* 左侧：候选人简报 */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-y-auto">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">候选人画像</h3>
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xl">
                {candidate.name[0]}
              </div>
              <div>
                <p className="font-bold text-slate-800">{candidate.name}</p>
                <p className="text-xs text-slate-500">{candidate.education}</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">核心技能</p>
                <div className="flex flex-wrap gap-2">
                  {candidate.skills.slice(0, 5).map((s, i) => (
                    <span key={i} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase">评分维度</p>
                  {(status === 'preparing' || status === 'accepted') && (
                    <button 
                      onClick={() => handleRefreshCriteria()}
                      disabled={isRefreshingCriteria}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center"
                      title="根据当前题目重新生成评分维度"
                    >
                      {isRefreshingCriteria ? (
                        <i className="fas fa-circle-notch fa-spin"></i>
                      ) : (
                        <><i className="fas fa-sync-alt mr-1"></i> 刷新</>
                      )}
                    </button>
                  )}
                </div>
                <ul className="space-y-2">
                  {(plan.evaluation_criteria || []).map((ec, i) => (
                    <li key={i} className="flex items-center text-xs font-medium text-slate-600">
                      <i className="fas fa-check-circle text-green-500 mr-2"></i> {ec}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-xs text-indigo-800 leading-relaxed italic">
                "{candidate.summary}"
              </div>
            </div>
          </div>

          {/* 中间：面试问题展示 */}
          <div className="lg:col-span-2 flex flex-col space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex-1 overflow-y-auto">
              {currentStep < plan.questions.length ? (
                <>
                  <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center space-x-4">
                      <h3 className="text-lg font-black text-slate-800">定制化面试提纲</h3>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                        plan.questions[currentStep].difficulty === '困难' ? 'bg-rose-50 text-rose-600' :
                        plan.questions[currentStep].difficulty === '中等' ? 'bg-amber-50 text-amber-600' :
                        'bg-emerald-50 text-emerald-600'
                      }`}>
                        {plan.questions[currentStep].difficulty}
                      </span>
                      <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg uppercase">
                        {plan.questions[currentStep].category}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                      第 {currentStep + 1} / {plan.questions.length} 题
                    </span>
                  </div>

                  <div className="space-y-8">
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                      <div className="flex justify-between items-start mb-3">
                        <p className="text-xs font-black text-indigo-500 uppercase tracking-widest">提问内容</p>
                        {(status === 'preparing' || status === 'accepted' || status === 'in_progress') && (
                          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {editingIndex === currentStep ? (
                              <button 
                                onClick={() => handleCompleteManualQuestion(currentStep)}
                                disabled={isCompletingManual}
                                className="text-[10px] font-bold text-green-600 hover:text-green-800 flex items-center bg-white px-2 py-1 rounded-lg border border-green-100 shadow-sm"
                              >
                                {isCompletingManual ? (
                                  <i className="fas fa-circle-notch fa-spin"></i>
                                ) : (
                                  <><i className="fas fa-check mr-1"></i> 保存并让 AI 补充</>
                                )}
                              </button>
                            ) : (
                              <>
                                <button 
                                  onClick={() => {
                                    setEditingIndex(currentStep);
                                    setManualQuestionText(plan.questions[currentStep].question);
                                  }}
                                  className="text-[10px] font-bold text-slate-600 hover:text-slate-800 flex items-center bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm"
                                >
                                  <i className="fas fa-edit mr-1"></i> 手动调整
                                </button>
                                <div className="h-4 w-[1px] bg-slate-200"></div>
                                <input 
                                  type="text"
                                  placeholder="告诉 AI 调整要求..."
                                  value={singleQuestionFeedback}
                                  onChange={(e) => setSingleQuestionFeedback(e.target.value)}
                                  className="text-[10px] px-2 py-1 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none w-32"
                                />
                                <button 
                                  onClick={() => handleRegenerateSingleQuestion(currentStep)}
                                  disabled={isRegeneratingSingle}
                                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center bg-white px-2 py-1 rounded-lg border border-indigo-100 shadow-sm"
                                  title="针对这道题重新生成"
                                >
                                  {isRegeneratingSingle ? (
                                    <i className="fas fa-circle-notch fa-spin"></i>
                                  ) : (
                                    <><i className="fas fa-sync-alt mr-1"></i> 换一题</>
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      {editingIndex === currentStep ? (
                        <textarea
                          value={manualQuestionText}
                          onChange={(e) => setManualQuestionText(e.target.value)}
                          className="w-full p-4 border border-indigo-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-lg font-bold text-slate-800 leading-snug outline-none"
                          rows={3}
                          autoFocus
                        />
                      ) : (
                        <h4 className="text-xl font-bold text-slate-800 leading-snug">
                          {plan.questions[currentStep].question}
                        </h4>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-5 border border-slate-100 rounded-2xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">考察目的</p>
                        <div className="text-sm text-slate-600 leading-relaxed font-medium markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {plan.questions[currentStep].purpose}
                          </ReactMarkdown>
                        </div>
                      </div>
                      <div className="p-5 border border-slate-100 rounded-2xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">期望回答</p>
                        <div className="text-sm text-slate-600 leading-relaxed font-medium markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {plan.questions[currentStep].expected_answer}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                      <p className="text-[10px] font-black text-indigo-400 uppercase mb-2">出题依据</p>
                      <div className="text-sm text-indigo-900 leading-relaxed font-medium italic markdown-content">
                        <i className="fas fa-quote-left text-[10px] mr-2 opacity-50"></i>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {plan.questions[currentStep].source}
                        </ReactMarkdown>
                        <i className="fas fa-quote-right text-[10px] ml-2 opacity-50"></i>
                      </div>
                    </div>

                    {/* 当前题目评价区 - 仅在面试进行中展示 */}
                    {status === 'in_progress' && (
                      <div className="pt-6 border-t border-slate-100 space-y-6">
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">候选人回答 (支持语音录入)</label>
                            <button
                              onClick={() => isRecording ? stopRecording() : startRecording(currentStep)}
                              className={`flex items-center space-x-2 px-3 py-1 rounded-full text-[10px] font-black transition-all ${
                                isRecording 
                                  ? 'bg-rose-100 text-rose-600 animate-pulse' 
                                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                              }`}
                            >
                              <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
                              <span>{isRecording ? '正在录音... 点击停止' : '开始录音'}</span>
                            </button>
                          </div>
                          <textarea
                            value={plan.questions[currentStep].answer || ''}
                            onChange={(e) => handleQuestionAnswerChange(currentStep, e.target.value)}
                            className="w-full h-32 p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm bg-slate-50/30"
                            placeholder="在此记录候选人的回答，或点击上方麦克风进行语音转文字..."
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">面试官笔记</label>
                          <textarea
                            value={plan.questions[currentStep].notes || ''}
                            onChange={(e) => handleQuestionNoteChange(currentStep, e.target.value)}
                            className="w-full h-24 p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm bg-slate-50/30"
                            placeholder="记录该题目的面试要点、亮点或不足..."
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">本题评分</label>
                          <div className="flex space-x-2">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <button
                                key={s}
                                onClick={() => handleQuestionScoreChange(currentStep, s)}
                                className={`w-12 h-12 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${
                                  plan.questions[currentStep].score === s
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110'
                                    : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200 hover:text-indigo-500'
                                }`}
                              >
                                <span className="text-sm font-black">{s}</span>
                              </button>
                            ))}
                            <span className="ml-4 flex items-center text-xs font-bold text-slate-400">
                              {plan.questions[currentStep].score === 1 && "非常不满意"}
                              {plan.questions[currentStep].score === 2 && "不满意"}
                              {plan.questions[currentStep].score === 3 && "一般"}
                              {plan.questions[currentStep].score === 4 && "满意"}
                              {plan.questions[currentStep].score === 5 && "非常满意"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (status === 'in_progress' || status === 'pending_decision') ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-check-double text-3xl"></i>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800">
                      {status === 'pending_decision' ? '面试已结束，请填写结论' : '面试题目已全部完成'}
                    </h3>
                    <p className="text-slate-500 mt-2">请填写最终评价并给出录用建议</p>
                  </div>

                  <div className="space-y-8 max-w-2xl mx-auto">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4 text-center">录用结论</label>
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { id: 'hire', label: '建议录用', color: 'emerald', icon: 'fa-user-check' },
                          { id: 'pass', label: '进入下一轮', color: 'indigo', icon: 'fa-arrow-right-to-bracket' },
                          { id: 'reject', label: '不建议录用', color: 'rose', icon: 'fa-user-xmark' },
                        ].map((decision) => (
                          <button
                            key={decision.id}
                            onClick={() => setHiringDecision(decision.id)}
                            className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center space-y-3 ${
                              hiringDecision === decision.id
                                ? `bg-${decision.color}-50 border-${decision.color}-500 text-${decision.color}-600 shadow-lg shadow-${decision.color}-100`
                                : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                            }`}
                          >
                            <i className={`fas ${decision.icon} text-xl`}></i>
                            <span className="text-sm font-black">{decision.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4 text-center">综合面试总结</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="在此输入对候选人的综合评价、团队契合度、优缺点总结等..."
                        className="w-full h-48 p-6 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm"
                      />
                    </div>

                    {/* AI 综合评价区域 */}
                    <div className="pt-8 border-t border-slate-100">
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="text-sm font-black text-slate-800 flex items-center">
                          <i className="fas fa-robot text-indigo-500 mr-2"></i> AI 智能评估分析
                        </h4>
                        <button
                          onClick={handleEvaluateInterview}
                          disabled={isEvaluating}
                          className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black hover:bg-indigo-100 transition-all flex items-center"
                        >
                          {isEvaluating ? (
                            <><i className="fas fa-circle-notch fa-spin mr-2"></i> 正在生成评估...</>
                          ) : (
                            <><i className="fas fa-magic mr-2"></i> 生成 AI 面试评价</>
                          )}
                        </button>
                      </div>

                      {evaluationResult ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                          {/* 综合建议置顶 */}
                          <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-3xl shadow-sm">
                            <div className="flex items-center mb-3">
                              <div className="w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center mr-3 shadow-sm">
                                <i className="fas fa-lightbulb text-xs"></i>
                              </div>
                              <p className="text-xs font-black text-indigo-600 uppercase tracking-wider">AI 综合建议与决策</p>
                            </div>
                            <div className="text-sm text-indigo-900 font-medium leading-relaxed markdown-content pl-11">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {evaluationResult.comprehensive_suggestion}
                              </ReactMarkdown>
                            </div>
                          </div>

                          {/* 分维度评价 */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors">
                              <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center">
                                <i className="fas fa-code mr-2 text-indigo-400"></i> 技术层面
                              </p>
                              <div className="text-xs text-slate-600 leading-relaxed markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {evaluationResult.technical_evaluation}
                                </ReactMarkdown>
                              </div>
                            </div>
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors">
                              <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center">
                                <i className="fas fa-comment-alt mr-2 text-indigo-400"></i> 逻辑表达
                              </p>
                              <div className="text-xs text-slate-600 leading-relaxed markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {evaluationResult.logical_evaluation}
                                </ReactMarkdown>
                              </div>
                            </div>
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors">
                              <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center">
                                <i className="fas fa-brain mr-2 text-indigo-400"></i> 思路清晰度
                              </p>
                              <div className="text-xs text-slate-600 leading-relaxed markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {evaluationResult.clarity_evaluation}
                                </ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 border-2 border-dashed border-slate-100 rounded-3xl text-center">
                          <p className="text-xs text-slate-400">点击上方按钮，AI 将根据面试过程中的表现给出专业评价建议</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full space-y-6">
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
                    <i className="fas fa-play text-3xl ml-1"></i>
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-black text-slate-800">题目准备已就绪</h3>
                    <p className="text-slate-500 mt-2 max-w-md">您已完成题目配置。请在面试开始时点击下方按钮，系统将开启评分记录模式。</p>
                  </div>
                  <button 
                    onClick={handleStartInterview}
                    className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center"
                  >
                    <i className="fas fa-play mr-3"></i> 开始正式面试
                  </button>
                </div>
              )}

              <div className="mt-12 flex justify-between">
                <button 
                  onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                  disabled={currentStep === 0}
                  className="px-6 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-slate-600 disabled:opacity-0 transition-all"
                >
                  <i className="fas fa-chevron-left mr-2"></i> 上一题
                </button>
                {currentStep < plan.questions.length ? (
                  <button 
                    onClick={() => setCurrentStep(prev => prev + 1)}
                    className="bg-slate-900 text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all flex items-center"
                  >
                    {currentStep === plan.questions.length - 1 ? (status === 'in_progress' ? "填写最终评价" : "准备就绪") : "下一题"} 
                    <i className="fas fa-chevron-right ml-2"></i>
                  </button>
                ) : status === 'in_progress' && (
                  <button 
                    onClick={handleFinishInterview}
                    className="bg-indigo-600 text-white px-10 py-3 rounded-xl text-sm font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all"
                  >
                    提交并完成面试
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-96 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-6">
            <i className="fas fa-clipboard-list text-3xl"></i>
          </div>
          <h3 className="text-xl font-black text-slate-800">面试题目尚未准备</h3>
          <p className="text-slate-500 mt-2 mb-8">请先进入准备阶段，智能生成或手动录入面试题目</p>
          
          {(status === 'accepted' || status === 'in_progress') ? (
            <button 
              onClick={handleStartPreparing}
              className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center"
            >
              <i className="fas fa-tools mr-3"></i> 开始准备面试
            </button>
          ) : (
            <p className="text-slate-400 italic">请联系管理员为您配置面试任务</p>
          )}
        </div>
      )}
    </div>
  );
};

export default InterviewAssistant;
