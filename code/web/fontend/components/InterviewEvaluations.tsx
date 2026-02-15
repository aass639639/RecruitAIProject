import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import { Interview, User, Candidate, JobDescription } from '../types';

interface InterviewEvaluationsProps {
  currentUser: User | null;
  preselectedCandidateId?: string | null;
  preselectedInterviewSearch?: string | null;
  onClearPreselect?: () => void;
  onClearInterviewSearch?: () => void;
  initialSelectedInterviewId?: number | null;
  onClearInitialInterview?: () => void;
  onBack?: () => void;
}

interface GroupedEvaluation {
  candidate: Candidate;
  interviews: Interview[];
  status: 'hired' | 'rejected' | 'interviewing' | 'not_started';
}

const InterviewEvaluations: React.FC<InterviewEvaluationsProps> = ({ 
  currentUser, 
  preselectedCandidateId, 
  preselectedInterviewSearch,
  onClearPreselect, 
  onClearInterviewSearch,
  initialSelectedInterviewId,
  onClearInitialInterview,
  onBack 
}) => {
  const [groupedEvaluations, setGroupedEvaluations] = useState<GroupedEvaluation[]>([]);
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  
  // 录用弹窗状态
  const [hiringCandidate, setHiringCandidate] = useState<{candidate: Candidate, jobId: number} | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  
  // 搜索、筛选和排序状态
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, hired, rejected, interviewing
  const [sortBy, setSortBy] = useState<'name' | 'time'>('time');

  useEffect(() => {
    fetchEvaluations();
  }, []);

  useEffect(() => {
    if (preselectedCandidateId && groupedEvaluations.length > 0) {
      const group = groupedEvaluations.find(g => String(g.candidate.id) === String(preselectedCandidateId));
      if (group) {
        setSelectedCandidateId(preselectedCandidateId);
        // Clear search term and filter to show the candidate
        setSearchTerm(group.candidate.name);
      }
    }
  }, [preselectedCandidateId, groupedEvaluations]);

  useEffect(() => {
    if (initialSelectedInterviewId && groupedEvaluations.length > 0) {
      // 在所有分组中寻找该面试 ID
      for (const group of groupedEvaluations) {
        const interview = group.interviews.find(i => i.id === initialSelectedInterviewId);
        if (interview) {
          setSelectedCandidateId(String(group.candidate.id));
          setSelectedInterview(interview);
          onClearInitialInterview?.();
          break;
        }
      }
    }
  }, [initialSelectedInterviewId, groupedEvaluations, onClearInitialInterview]);

  useEffect(() => {
    if (preselectedInterviewSearch) {
      setSearchTerm(preselectedInterviewSearch);
      onClearInterviewSearch?.();
    }
  }, [preselectedInterviewSearch, onClearInterviewSearch]);

  const fetchEvaluations = async () => {
    setLoading(true);
    try {
      const [interviewsRes, jdsRes] = await Promise.all([
        axios.get('http://localhost:8000/api/v1/interviews/'),
        axios.get('http://localhost:8000/api/v1/job-descriptions/')
      ]);
      
      const allInterviews: Interview[] = interviewsRes.data;
      setJds(jdsRes.data);
      
      // Group by candidate
      const groups: { [key: number]: GroupedEvaluation } = {};
      
      allInterviews.forEach(interview => {
        if (!interview.candidate) return;
        const cid = interview.candidate.id;
        if (!groups[cid]) {
          groups[cid] = {
            candidate: interview.candidate,
            interviews: [],
            status: 'not_started'
          };
        }
        groups[cid].interviews.push(interview);
      });

      // Sort interviews by date and determine status
      const processedGroups = Object.values(groups).map(group => {
        group.interviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        // Determine status based on the latest hiring decisions or overall interview status
        const hasHired = group.interviews.some(i => i.hiring_decision === 'hire');
        const allCompleted = group.interviews.every(i => i.status === 'completed');
        const anyInProgress = group.interviews.some(i => ['in_progress', 'accepted', 'preparing', 'pending_decision'].includes(i.status));
        const lastDecision = group.interviews[0]?.hiring_decision;

        if (hasHired) group.status = 'hired';
        else if (lastDecision === 'reject' && allCompleted) group.status = 'rejected';
        else if (anyInProgress) group.status = 'interviewing';
        else group.status = 'not_started';

        return group;
      });

      setGroupedEvaluations(processedGroups);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultJobToHire = (group: GroupedEvaluation) => {
    // 只有当最新一轮面试结果是建议录用时，才返回该岗位 ID
    const latestInterview = group.interviews[0];
    if (latestInterview && latestInterview.hiring_decision === 'hire' && latestInterview.job_id) {
      return latestInterview.job_id;
    }
    return null;
  };

  const canHireCandidate = (group: GroupedEvaluation) => {
    const candidate = group.candidate;
    const latestInterview = group.interviews[0];
    const targetJobId = latestInterview?.job_id;

    // 0. 检查岗位是否已满
    const targetJd = targetJobId ? jds.find(j => j.id === targetJobId) : null;
    const isNotFull = targetJd ? targetJd.current_hired_count < targetJd.requirement_count : true;

    // 1. 最新一轮面试结果必须是建议录用
    const isRecommended = latestInterview?.hiring_decision === 'hire';
    
    // 2. 员工不能是已入职状态
    const isNotHired = candidate.status !== 'hired';
    
    // 3. 针对某个人面试某个岗位只有一次入职机会。如果员工针对该岗位已离职，则不能再入职
    // 逻辑：如果状态是离职，且离职关联的岗位就是当前面试的岗位，则禁止入职
    const isNotResignedFromThisJob = !(candidate.status === 'resigned' && candidate.job_id === targetJobId);

    return isRecommended && isNotHired && isNotResignedFromThisJob && isNotFull;
  };

  const handleHire = async () => {
    if (!hiringCandidate) return;
    
    try {
      await axios.put(`http://localhost:8000/api/v1/candidates/${hiringCandidate.candidate.id}`, {
        status: 'hired',
        job_id: hiringCandidate.jobId
      });
      
      // 刷新数据
      fetchEvaluations();
      setShowHireModal(false);
      setHiringCandidate(null);
      
      alert(`已成功录用候选人 ${hiringCandidate.candidate.name}`);
    } catch (error) {
      console.error('Error hiring candidate:', error);
      alert('录用操作失败，请重试');
    }
  };

  // 过滤和排序逻辑
  const filteredAndSortedEvaluations = groupedEvaluations
    .filter(group => {
      // 如果有预选候选人，强制只显示该候选人
      if (preselectedCandidateId) {
        return String(group.candidate.id) === String(preselectedCandidateId);
      }
      
      // 搜索过滤
      const matchesSearch = group.candidate.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // 状态过滤
      const matchesStatus = statusFilter === 'all' || group.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.candidate.name.localeCompare(b.candidate.name);
      } else {
        // 按最新面试时间排序 (updated_at)
        const timeA = new Date(a.interviews[0]?.updated_at || 0).getTime();
        const timeB = new Date(b.interviews[0]?.updated_at || 0).getTime();
        return timeB - timeA;
      }
    });

  if (loading) return <div className="flex justify-center p-20"><i className="fas fa-spinner fa-spin text-3xl text-indigo-600"></i></div>;

  const getJobTitle = (jobId?: number) => {
    if (!jobId) return null;
    const jd = jds.find(j => j.id === jobId);
    return jd ? jd.title : null;
  };

  // Detail View for a specific Interview
  if (selectedInterview) {
    const jobTitle = getJobTitle(selectedInterview.job_id) || selectedInterview.candidate?.position || '未知岗位';
    
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setSelectedInterview(null)}
              className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <i className="fas fa-arrow-left"></i>
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-800">面试详情报告</h1>
              <div className="flex items-center space-x-2 mt-1">
                <p className="text-sm text-slate-500">
                  面试岗位: <span className="text-indigo-600 font-bold">{jobTitle}</span>
                </p>
                <span className="text-slate-300">·</span>
                <p className="text-sm text-slate-500">
                  面试官: <span className="text-indigo-600 font-bold">{selectedInterview.interviewer?.full_name}</span>
                </p>
                <span className="text-slate-300">·</span>
                <p className="text-sm text-slate-500">
                  面试日期: {new Date(selectedInterview.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {(selectedInterview.hiring_decision === 'hire' || selectedInterview.hiring_decision === 'pass') && 
             selectedInterview.candidate?.status !== 'hired' && (
              <button 
                onClick={() => {
                  setHiringCandidate({
                    candidate: selectedInterview.candidate!,
                    jobId: selectedInterview.job_id!
                  });
                  setShowHireModal(true);
                }}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center space-x-2"
              >
                <i className="fas fa-user-plus"></i>
                <span>一键录用</span>
              </button>
            )}
            <button 
              onClick={() => setSelectedInterview(null)}
              className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
            >
              返回列表
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">评价维度</h3>
              <div className="flex flex-wrap gap-2">
                {selectedInterview.evaluation_criteria?.map((criteria, i) => (
                  <span key={i} className="text-[10px] font-bold bg-white text-indigo-600 border border-indigo-100 px-2 py-1 rounded-md">
                    {criteria}
                  </span>
                )) || <span className="text-xs text-slate-400 italic">未记录评分维度</span>}
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">录用结论</h3>
              {selectedInterview.hiring_decision ? (
                <div className={`p-6 rounded-2xl border-2 flex flex-col items-center space-y-3 ${
                  selectedInterview.hiring_decision === 'hire' ? 'bg-emerald-50 border-emerald-500 text-emerald-600' :
                  selectedInterview.hiring_decision === 'pass' ? 'bg-indigo-50 border-indigo-500 text-indigo-600' :
                  'bg-rose-50 border-rose-500 text-rose-600'
                }`}>
                  <i className={`fas ${
                    selectedInterview.hiring_decision === 'hire' ? 'fa-user-check' :
                    selectedInterview.hiring_decision === 'pass' ? 'fa-arrow-right-to-bracket' :
                    'fa-user-xmark'
                  } text-2xl`}></i>
                  <span className="text-lg font-black">
                    {selectedInterview.hiring_decision === 'hire' ? '建议录用' :
                     selectedInterview.hiring_decision === 'pass' ? '进入下一轮' : '不建议录用'}
                  </span>
                </div>
              ) : (
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-sm text-slate-400 italic">未记录录用结论</p>
                </div>
              )}
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">面试官总结</h3>
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-sm text-amber-900 leading-relaxed min-h-[150px] markdown-content">
                {selectedInterview.notes ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedInterview.notes}
                  </ReactMarkdown>
                ) : "未填写面试笔记"}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {selectedInterview.ai_evaluation && (
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">AI 智能面试评估</h3>
                  <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black flex items-center">
                    <i className="fas fa-robot mr-2"></i> AI 自动生成
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="p-6 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                    <p className="text-[10px] font-black text-indigo-400 uppercase mb-2 tracking-wider">综合建议与决策</p>
                    <div className="text-sm text-indigo-900 font-medium leading-relaxed markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {selectedInterview.ai_evaluation.comprehensive_suggestion}
                      </ReactMarkdown>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase flex items-center">
                          <i className="fas fa-code mr-2 text-indigo-400"></i> 技术层面
                        </p>
                        {selectedInterview.ai_evaluation.technical_evaluation?.score !== undefined && (
                          <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">
                            {selectedInterview.ai_evaluation.technical_evaluation.score}分
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {typeof selectedInterview.ai_evaluation.technical_evaluation === 'string'
                            ? selectedInterview.ai_evaluation.technical_evaluation
                            : (selectedInterview.ai_evaluation.technical_evaluation?.feedback || "")}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase flex items-center">
                          <i className="fas fa-comment-alt mr-2 text-indigo-400"></i> 逻辑表达
                        </p>
                        {selectedInterview.ai_evaluation.logical_evaluation?.score !== undefined && (
                          <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">
                            {selectedInterview.ai_evaluation.logical_evaluation.score}分
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {typeof selectedInterview.ai_evaluation.logical_evaluation === 'string'
                            ? selectedInterview.ai_evaluation.logical_evaluation
                            : (selectedInterview.ai_evaluation.logical_evaluation?.feedback || "")}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase flex items-center">
                          <i className="fas fa-brain mr-2 text-indigo-400"></i> 沟通能力
                        </p>
                        {(selectedInterview.ai_evaluation.communication_evaluation?.score !== undefined || (selectedInterview.ai_evaluation as any).clarity_evaluation?.score !== undefined) && (
                          <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">
                            {selectedInterview.ai_evaluation.communication_evaluation?.score ?? (selectedInterview.ai_evaluation as any).clarity_evaluation?.score}分
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {typeof selectedInterview.ai_evaluation.communication_evaluation === 'string'
                            ? selectedInterview.ai_evaluation.communication_evaluation
                            : (selectedInterview.ai_evaluation.communication_evaluation?.feedback || (selectedInterview.ai_evaluation as any).clarity_evaluation?.feedback || (selectedInterview.ai_evaluation as any).clarity_evaluation || "")}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">面试题目详情</h3>
              <div className="space-y-8">
                {selectedInterview.questions?.map((q: any, index: number) => (
                  <div key={index} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center space-x-3">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">
                          {index + 1}
                        </span>
                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">
                          {q.category}
                        </span>
                      </div>
                      {q.score && (
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <i key={star} className={`fas fa-star text-[10px] ${star <= q.score ? 'text-amber-400' : 'text-slate-200'}`}></i>
                          ))}
                          <span className="ml-2 text-xs font-black text-amber-600">{q.score}分</span>
                        </div>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-slate-800 mb-2">{q.question}</h4>
                    {q.answer && (
                      <div className="mt-3 p-4 bg-indigo-50/30 rounded-xl border border-indigo-100/50 markdown-content">
                        <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">候选人回答</p>
                        <div className="text-sm text-slate-700 leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {q.answer}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                    {q.notes && (
                      <div className="mt-4 p-4 bg-white rounded-xl border border-slate-100 markdown-content">
                        <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">面试官评价</p>
                        <div className="text-sm text-slate-700 italic">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {q.notes}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          {onBack && (
            <button 
              onClick={onBack}
              className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all group"
              title="返回上级页面"
            >
              <i className="fas fa-arrow-left group-hover:-translate-x-0.5 transition-transform"></i>
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black text-slate-800">面试评价管理</h1>
            <p className="text-sm text-slate-500 mt-1">查看所有候选人的面试评价与录用建议</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {preselectedCandidateId && (
            <div className="flex items-center bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl border border-indigo-100 animate-in zoom-in duration-300">
              <span className="text-sm font-bold mr-2">正在查看特定候选人</span>
              <button 
                onClick={onClearPreselect}
                className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors"
                title="清除筛选"
              >
                <i className="fas fa-times text-[10px]"></i>
              </button>
            </div>
          )}
          
          <div className="relative">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input 
              type="text"
              placeholder="搜索候选人姓名..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-48 transition-all"
            />
          </div>
          
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
          >
            <option value="all">全部状态</option>
            <option value="hired">已经入职</option>
            <option value="rejected">被拒绝</option>
            <option value="interviewing">面试流程中</option>
          </select>

          <div className="flex bg-white border border-slate-200 rounded-xl p-1">
            <button 
              onClick={() => setSortBy('time')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'time' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              时间排序
            </button>
            <button 
              onClick={() => setSortBy('name')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'name' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              姓名排序
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {filteredAndSortedEvaluations.length > 0 ? (
          filteredAndSortedEvaluations.map((group) => (
            <div key={group.candidate.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div 
                className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={() => setSelectedCandidateId(selectedCandidateId === group.candidate.id ? null : group.candidate.id)}
              >
                <div className="flex items-center space-x-6">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 font-black text-2xl border border-slate-200">
                    {group.candidate.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center space-x-3 mb-1">
                      <h3 className="text-xl font-black text-slate-800">{group.candidate.name}</h3>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                        group.status === 'hired' ? 'bg-emerald-50 text-emerald-600' :
                        group.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                        group.status === 'interviewing' ? 'bg-indigo-50 text-indigo-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {group.status === 'hired' ? '录用中' :
                         group.status === 'rejected' ? '未录用' :
                         group.status === 'interviewing' ? '面试中' : '未开始'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 font-medium">
                      面试岗位: <span className="text-slate-600 font-bold">{getJobTitle(group.interviews[0]?.job_id) || group.candidate.position || '未知岗位'}</span> · 共 {group.interviews.length} 轮面试
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {canHireCandidate(group) && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const jobId = getDefaultJobToHire(group);
                        if (jobId) {
                          setHiringCandidate({ candidate: group.candidate, jobId });
                          setShowHireModal(true);
                        }
                      }}
                      className="px-4 py-2 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 transition-all shadow-sm hover:shadow-emerald-200/50 flex items-center"
                    >
                      <i className="fas fa-user-check mr-2"></i>
                      一键录用
                    </button>
                  )}
                  <div className="flex items-center space-x-2 text-slate-400 text-sm font-bold">
                    {selectedCandidateId === group.candidate.id ? '收起详情' : '展开记录'}
                    <i className={`fas fa-chevron-${selectedCandidateId === group.candidate.id ? 'up' : 'down'} ml-2`}></i>
                  </div>
                </div>
              </div>

              {selectedCandidateId === group.candidate.id && (
                <div className="border-t border-slate-100 bg-slate-50/30 p-8">
                  <div className="space-y-4">
                    {group.interviews.map((interview, idx) => (
                      <div 
                        key={interview.id} 
                        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-indigo-200 transition-all cursor-pointer group"
                        onClick={() => setSelectedInterview(interview)}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                            <span className="text-xs font-black">第{group.interviews.length - idx}轮</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">
                              面试官: {interview.interviewer?.full_name}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <p className="text-xs text-slate-400">
                                岗位: <span className="text-indigo-600/70 font-bold">{getJobTitle(interview.job_id) || '未知岗位'}</span>
                              </p>
                              <span className="text-slate-200 text-[10px]">|</span>
                              <p className="text-xs text-slate-400">
                                时间: {new Date(interview.updated_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-6">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                            interview.status === 'completed' ? 'bg-slate-100 text-slate-500' :
                            interview.status === 'pending_decision' ? 'bg-purple-50 text-purple-600' :
                            'bg-indigo-50 text-indigo-600'
                          }`}>
                            {interview.status === 'completed' ? '已完成' :
                             interview.status === 'pending_decision' ? '待评价' : '进行中'}
                          </span>
                          {interview.hiring_decision && (
                            <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${
                              interview.hiring_decision === 'hire' ? 'bg-emerald-50 text-emerald-600' :
                              interview.hiring_decision === 'pass' ? 'bg-indigo-50 text-indigo-600' :
                              'bg-rose-50 text-rose-600'
                            }`}>
                              {interview.hiring_decision === 'hire' ? '建议录用' :
                               interview.hiring_decision === 'pass' ? '进入下一轮' : '不建议录用'}
                            </div>
                          )}
                          <i className="fas fa-chevron-right text-slate-300 group-hover:text-indigo-400 transition-colors"></i>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white rounded-3xl p-20 text-center border border-dashed border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-filter text-slate-300 text-3xl"></i>
            </div>
            <h3 className="text-xl font-bold text-slate-800">未找到匹配记录</h3>
            <p className="text-slate-500 mt-2">请尝试调整搜索词或筛选条件</p>
          </div>
        )}
      </div>

      {/* 录用确认弹窗 */}
      {showHireModal && hiringCandidate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl mb-6">
                <i className="fas fa-user-check"></i>
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">确认录用候选人</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                您确定要录用 <span className="font-bold text-slate-800">{hiringCandidate.candidate.name}</span> 吗？
                <br />
                录用岗位：<span className="font-bold text-indigo-600">{getJobTitle(hiringCandidate.jobId) || '未知岗位'}</span>
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setShowHireModal(false);
                    setHiringCandidate(null);
                  }}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={handleHire}
                  className="flex-1 px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  确定录用
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewEvaluations;
