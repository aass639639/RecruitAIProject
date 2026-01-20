import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Interview, User, Candidate } from '../types';

interface InterviewEvaluationsProps {
  currentUser: User | null;
  preselectedCandidateId?: string | null;
  onClearPreselect?: () => void;
}

interface GroupedEvaluation {
  candidate: Candidate;
  interviews: Interview[];
  status: 'hired' | 'rejected' | 'interviewing' | 'not_started';
}

const InterviewEvaluations: React.FC<InterviewEvaluationsProps> = ({ currentUser, preselectedCandidateId, onClearPreselect }) => {
  const [groupedEvaluations, setGroupedEvaluations] = useState<GroupedEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  
  // 搜索、筛选和排序状态
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, hired, rejected, interviewing
  const [sortBy, setSortBy] = useState<'name' | 'time'>('time');

  useEffect(() => {
    fetchEvaluations();
  }, []);

  useEffect(() => {
    if (preselectedCandidateId && groupedEvaluations.length > 0) {
      const candidateIdNum = parseInt(preselectedCandidateId);
      const group = groupedEvaluations.find(g => String(g.candidate.id) === String(preselectedCandidateId));
      if (group) {
        setSelectedCandidateId(candidateIdNum);
        // Clear search term and filter to show the candidate
        setSearchTerm(group.candidate.name);
      }
    }
  }, [preselectedCandidateId, groupedEvaluations]);

  const fetchEvaluations = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/api/v1/interviews/');
      const allInterviews: Interview[] = response.data;
      
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
        const anyInProgress = group.interviews.some(i => i.status === 'in_progress' || i.status === 'accepted' || i.status === 'preparing');
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

  // 过滤和排序逻辑
  const filteredAndSortedEvaluations = groupedEvaluations
    .filter(group => {
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

  // Detail View for a specific Interview
  if (selectedInterview) {
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
              <p className="text-sm text-slate-500 mt-1">
                面试官: <span className="text-indigo-600 font-bold">{selectedInterview.interviewer?.full_name}</span> · 
                面试日期: {new Date(selectedInterview.updated_at).toLocaleDateString()}
              </p>
            </div>
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
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-sm text-amber-900 leading-relaxed min-h-[150px] whitespace-pre-wrap">
                {selectedInterview.notes || "未填写面试笔记"}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
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
                    {q.notes && (
                      <div className="mt-4 p-4 bg-white rounded-xl border border-slate-100">
                        <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">评价</p>
                        <p className="text-sm text-slate-700 italic">{q.notes}</p>
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
        <div>
          <h1 className="text-2xl font-black text-slate-800">面试评价管理</h1>
          <p className="text-sm text-slate-500 mt-1">查看所有候选人的面试评价与录用建议</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
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
                        {group.status === 'hired' ? '建议录用' :
                         group.status === 'rejected' ? '不建议录用' :
                         group.status === 'interviewing' ? '面试中' : '未开始'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 font-medium">
                      {group.candidate.position} · 共 {group.interviews.length} 轮面试
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-slate-400 text-sm font-bold">
                  {selectedCandidateId === group.candidate.id ? '收起详情' : '展开记录'}
                  <i className={`fas fa-chevron-${selectedCandidateId === group.candidate.id ? 'up' : 'down'} ml-2`}></i>
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
                            <p className="text-xs text-slate-400 mt-1">
                              面试时间: {new Date(interview.updated_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-6">
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
    </div>
  );
};

export default InterviewEvaluations;
