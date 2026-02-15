import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import { geminiService } from '../services/geminiService';
import { JobDescription, Candidate, User } from '../types';

type ViewMode = 'list' | 'detail' | 'edit' | 'create';

interface JobDescriptionManagerProps {
  currentUser: User | null;
  initialJdId?: number | null;
  initialStatusFilter?: 'all' | 'active' | 'closed' | 'full';
  initialShowMatching?: boolean;
  onClearInitialJd?: () => void;
  onViewEvaluations?: (candidateId?: string, jid?: number) => void;
  onViewCandidate?: (candidateId?: string, matchResult?: any) => void;
}

const JobDescriptionManager: React.FC<JobDescriptionManagerProps> = ({ 
  currentUser, 
  initialJdId, 
  initialStatusFilter,
  initialShowMatching,
  onClearInitialJd, 
  onViewEvaluations, 
  onViewCandidate 
}) => {
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedJd, setSelectedJd] = useState<JobDescription | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [hiredCandidates, setHiredCandidates] = useState<Candidate[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed' | 'full'>(initialStatusFilter || 'all');
  const [categoryFilter, setCategoryFilter] = useState('全部');
  const [isMatching, setIsMatching] = useState(false);
  const [matchingResults, setMatchingResults] = useState<{ 
    id: string; 
    score: number; 
    analysis: string;
    matching_points: string[];
    mismatched_points: string[];
  }[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const [closeReasonInput, setCloseReasonInput] = useState('');
  const [showMatchingSidePanel, setShowMatchingSidePanel] = useState(false);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [matchFilter, setMatchFilter] = useState<'all' | 'not_interviewed' | 'interviewed'>('all');
  
  // 面试官分配相关状态
  const [showInterviewerModal, setShowInterviewerModal] = useState(false);
  const [selectedCandidateForInterview, setSelectedCandidateForInterview] = useState<Candidate | null>(null);
  const [interviewerList, setInterviewerList] = useState<User[]>([]);
  const [selectedInterviewerId, setSelectedInterviewerId] = useState<number | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirement_count: 1,
    is_active: true,
    category: '技术类'
  });

  useEffect(() => {
    fetchJds();
    fetchCandidates();
    fetchInterviews();
  }, []);

  // 处理从其他页面带 JD ID 返回的情况
  useEffect(() => {
    if (initialJdId && jds.length > 0) {
      const jd = jds.find(j => j.id === initialJdId);
      if (jd) {
        handleGoToDetail(jd);
        if (initialShowMatching) {
          setShowMatchingSidePanel(true);
          // 触发匹配逻辑
          setTimeout(() => {
            const matchBtn = document.getElementById('start-match-btn');
            if (matchBtn) matchBtn.click();
          }, 500);
        }
        // 清除初始 ID，避免刷新时反复进入详情
        onClearInitialJd?.();
      }
    }
  }, [initialJdId, jds, initialShowMatching]);

  const fetchInterviews = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/v1/interviews/');
      setInterviews(response.data);
    } catch (error) {
      console.error('Error fetching interviews:', error);
    }
  };

  const fetchCandidates = async () => {
    try {
      const data = await geminiService.getCandidates();
      setCandidates(data);
    } catch (e) {
      console.error("获取候选人失败:", e);
    }
  };

  const fetchJds = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/api/v1/job-descriptions/');
      setJds(response.data);
    } catch (error) {
      console.error('Error fetching JDs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '未知时间';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fetchHiredCandidates = async (jdId: number) => {
    try {
      const response = await axios.get(`http://localhost:8000/api/v1/candidates/?job_id=${jdId}&status=hired`);
      setHiredCandidates(response.data);
    } catch (error) {
      console.error('Error fetching hired candidates:', error);
    }
  };

  const fetchInterviewers = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/v1/users/?role=interviewer');
      setInterviewerList(response.data);
    } catch (error) {
      console.error('Error fetching interviewers:', error);
    }
  };

  const handleOpenAssignModal = (candidate: Candidate) => {
    setSelectedCandidateForInterview(candidate);
    setShowInterviewerModal(true);
    fetchInterviewers();
  };

  const handleAssignInterviewer = async () => {
    if (!selectedCandidateForInterview || !selectedInterviewerId || !currentUser || !selectedJd) return;
    
    setIsAssigning(true);
    try {
      // 1. 创建面试记录
      await axios.post('http://localhost:8000/api/v1/interviews/', {
        candidate_id: Number(selectedCandidateForInterview.id),
        interviewer_id: selectedInterviewerId,
        admin_id: currentUser.id,
        job_id: selectedJd.id,
        status: 'pending'
      });

      // 2. 更新候选人状态和关联 JD
      await axios.put(`http://localhost:8000/api/v1/candidates/${selectedCandidateForInterview.id}`, {
        status: 'interviewing',
        job_id: selectedJd.id
      });

      alert('面试官分配成功！');
      setShowInterviewerModal(false);
      setSelectedInterviewerId(null);
      setSelectedCandidateForInterview(null);
      
      // 刷新面试列表和候选人列表
      fetchInterviews();
      fetchCandidates();
    } catch (error: any) {
      console.error('Error assigning interviewer:', error);
      alert(error.response?.data?.detail || '分配面试官失败');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleGoToDetail = (jd: JobDescription) => {
    setSelectedJd(jd);
    setViewMode('detail');
    setShowMatchingSidePanel(false);
    setMatchingResults([]);
    fetchHiredCandidates(jd.id);
    window.scrollTo(0, 0);
  };

  const handleGoToEdit = (jd: JobDescription) => {
    setSelectedJd(jd);
    setFormData({
      title: jd.title,
      description: jd.description,
      requirement_count: jd.requirement_count,
      is_active: jd.is_active,
      category: jd.category || '技术类'
    });
    setViewMode('edit');
    setIsPreview(false);
    window.scrollTo(0, 0);
  };

  const handleGoToCreate = () => {
    setSelectedJd(null);
    setFormData({
      title: '',
      description: '',
      requirement_count: 1,
      is_active: true,
      category: '技术类'
    });
    setViewMode('create');
    setIsPreview(false);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (viewMode === 'edit' && selectedJd) {
        await axios.put(`http://localhost:8000/api/v1/job-descriptions/${selectedJd.id}`, formData);
      } else {
        await axios.post('http://localhost:8000/api/v1/job-descriptions/', formData);
      }
      fetchJds();
      setViewMode('list');
    } catch (error) {
      console.error('Error saving JD:', error);
      alert('保存失败');
    }
  };

  const handleSmartGenerate = async () => {
    const text = formData.description || formData.title;
    if (!text.trim()) {
      alert('请先输入一些职位关键词或初步描述，以便 AI 为您生成。');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await geminiService.smartGenerateJD(text);
      setFormData({
        ...formData,
        title: result.title,
        description: result.description
      });
    } catch (error) {
      console.error('AI generation failed:', error);
      alert('AI 生成失败，请稍后再试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMatch = async (force = false) => {
    if (!selectedJd || candidates.length === 0) return;
    
    // 如果已经有结果且不是强制刷新，则只打开面板
    if (matchingResults.length > 0 && !force) {
      setShowMatchingSidePanel(true);
      // 即使不重新匹配，也刷新一下数据以显示最新的面试状态
      fetchInterviews();
      fetchCandidates();
      return;
    }

    setIsMatching(true);
    setShowMatchingSidePanel(true);
    setMatchingResults([]);
    try {
      // 过滤掉已经入职的候选人
      const candidatesToMatch = candidates.filter(c => c.status !== 'hired');
      
      const matchResults = await Promise.all(
        candidatesToMatch.map(async (c) => {
          const res = await geminiService.matchCandidate(c, selectedJd.description);
          return { id: c.id.toString(), ...res };
        })
      );
      // 过滤掉低于 70 分的结果
      const filteredResults = matchResults.filter(res => res.score >= 70);
      setMatchingResults(filteredResults.sort((a, b) => b.score - a.score));
      
      if (filteredResults.length === 0) {
        alert('抱歉，暂无合适候选人。');
      }
    } catch (e) {
      console.error(e);
      alert('匹配失败，请稍后再试');
    } finally {
      setIsMatching(false);
    }
  };

  const handleCloseConfirm = async () => {
    if (!selectedJd) return;
    
    const reason = closeReasonInput.trim();
    if (!reason) {
      alert('请填写关闭理由');
      return;
    }

    try {
      await axios.put(`http://localhost:8000/api/v1/job-descriptions/${selectedJd.id}`, {
        is_active: false,
        close_reason: reason
      });
      setIsClosing(false);
      setCloseReasonInput('');
      // Refresh data
      const response = await axios.get(`http://localhost:8000/api/v1/job-descriptions/${selectedJd.id}`);
      setSelectedJd(response.data);
      fetchJds();
    } catch (error) {
      console.error('Error closing JD:', error);
      alert('关闭失败');
    }
  };

  if (loading) return <div className="flex justify-center p-20"><i className="fas fa-spinner fa-spin text-3xl text-indigo-600"></i></div>;

  // 1. 列表视图
  const renderListView = () => {
    const filteredJds = jds.filter(jd => {
      // 类别筛选
      if (categoryFilter !== '全部' && jd.category !== categoryFilter) return false;
      
      // 状态筛选
      if (statusFilter === 'active') return jd.is_active && jd.current_hired_count < jd.requirement_count;
      if (statusFilter === 'closed') return !jd.is_active;
      if (statusFilter === 'full') return jd.current_hired_count >= jd.requirement_count;
      
      return true;
    });

    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">JD 管理</h2>
            <p className="text-slate-500 mt-2 font-medium">录入和管理正在招聘的职位需求</p>
          </div>
          <button
            onClick={handleGoToCreate}
            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 flex items-center space-x-3 group"
          >
            <i className="fas fa-plus group-hover:rotate-90 transition-transform"></i>
            <span>新增职位需求</span>
          </button>
        </div>

        {/* 筛选器 */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-wrap items-center gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">职位状态</label>
            <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100">
              {[
                { id: 'all', label: '全部' },
                { id: 'active', label: '正在招' },
                { id: 'full', label: '已招满' },
                { id: 'closed', label: '已关闭' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setStatusFilter(item.id as any)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === item.id 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">职位类别</label>
            <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100">
              {['全部', '技术类', '市场运营类', '行政财务类', '产品类', '其他'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    categoryFilter === cat 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredJds.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredJds.map((jd) => (
              <div 
                key={jd.id} 
                onClick={() => handleGoToDetail(jd)}
                className="group relative bg-white rounded-[2rem] border border-slate-100 p-1 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-2 cursor-pointer overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <div className="relative p-8 space-y-8">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {jd.current_hired_count >= jd.requirement_count ? (
                          <>
                            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">Full</span>
                          </>
                        ) : (
                          <>
                            <span className={`w-2.5 h-2.5 rounded-full ${jd.is_active ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></span>
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${jd.is_active ? 'text-green-600' : 'text-slate-400'}`}>
                              {jd.is_active ? 'Active' : 'Closed'}
                            </span>
                          </>
                        )}
                        <span className="text-[10px] font-bold text-slate-400 border-l border-slate-200 pl-2 ml-2">
                          发布于 {formatDate(jd.created_at)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100/50 shadow-sm break-words whitespace-normal max-w-full">
                          <i className="fas fa-tag mr-1.5 opacity-70 flex-shrink-0"></i>
                          <span className="leading-relaxed">{jd.category || '未分类'}</span>
                        </span>
                      </div>
                      <h3 
                        className="text-2xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2"
                        title={jd.title}
                      >
                        {jd.title}
                      </h3>
                    </div>
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm group-hover:shadow-indigo-200">
                      <i className="fas fa-briefcase text-2xl"></i>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50/80 rounded-2xl p-4 text-center transition-all duration-500 group-hover:bg-white group-hover:shadow-md">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">需求</p>
                      <p className="text-xl font-black text-slate-800">{jd.requirement_count}</p>
                    </div>
                    <div className="bg-indigo-50/50 rounded-2xl p-4 text-center transition-all duration-500 group-hover:bg-white group-hover:shadow-md">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1 tracking-wider">入职</p>
                      <p className="text-xl font-black text-indigo-600">{jd.current_hired_count}</p>
                    </div>
                    <div className="bg-orange-50/50 rounded-2xl p-4 text-center transition-all duration-500 group-hover:bg-white group-hover:shadow-md">
                      <p className="text-[10px] font-bold text-orange-400 uppercase mb-1 tracking-wider">剩余</p>
                      <p className="text-xl font-black text-orange-600">
                        {Math.max(0, jd.requirement_count - jd.current_hired_count)}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between border-t border-slate-50 group-hover:border-indigo-50 transition-colors">
                    <div className="flex -space-x-3">
                      {candidates
                        .filter(c => c.status === 'hired' && Number(c.job_id) === jd.id)
                        .slice(0, 4)
                        .map((candidate) => (
                          <div key={candidate.id} className="w-10 h-10 rounded-full border-4 border-white bg-indigo-100 flex items-center justify-center overflow-hidden shadow-sm" title={candidate.name}>
                            <span className="text-xs font-black text-indigo-600">{candidate.name[0]}</span>
                          </div>
                        ))}
                      {candidates.filter(c => c.status === 'hired' && Number(c.job_id) === jd.id).length > 4 && (
                        <div className="w-10 h-10 rounded-full border-4 border-white bg-indigo-50 flex items-center justify-center text-xs font-black text-indigo-600 shadow-sm">
                          +{candidates.filter(c => c.status === 'hired' && Number(c.job_id) === jd.id).length - 4}
                        </div>
                      )}
                      {candidates.filter(c => c.status === 'hired' && Number(c.job_id) === jd.id).length === 0 && (
                        <div className="text-xs font-bold text-slate-300 italic">暂无入职人员</div>
                      )}
                    </div>
                    <div className="text-sm font-black text-indigo-600 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 flex items-center">
                      详情 <i className="fas fa-arrow-right ml-2 text-xs"></i>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 space-y-6">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
              <i className="fas fa-briefcase text-5xl"></i>
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl font-black text-slate-400">未找到相关职位需求</p>
              <p className="text-sm text-slate-300 font-bold">尝试调整筛选条件，或者创建一个新的职位</p>
            </div>
            <button
              onClick={handleGoToCreate}
              className="px-8 py-3 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-sm hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
            >
              创建新职位
            </button>
          </div>
        )}
      </div>
    );
  };

  // 2. 详情视图
  const renderDetailView = () => {
    if (!selectedJd) return null;
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => {
              setViewMode('list');
              setShowMatchingSidePanel(false);
            }}
            className="flex items-center space-x-2 text-slate-400 hover:text-indigo-600 font-bold transition-colors group"
          >
            <i className="fas fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
            <span>返回职位列表</span>
          </button>
        </div>

        <div className="space-y-8 w-full">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
              <div className="p-10 border-b border-slate-50 bg-gradient-to-br from-slate-50/50 to-white">
                <div className="flex justify-between items-start mb-8">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      {selectedJd.current_hired_count >= selectedJd.requirement_count ? (
                        <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-orange-100 text-orange-700">
                          已招满
                        </span>
                      ) : (
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedJd.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {selectedJd.is_active ? '进行中' : '已关闭'}
                        </span>
                      )}
                      <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700">
                        {selectedJd.category || '未分类'}
                      </span>
                      <span className="text-slate-300 text-xs font-bold">ID: #{selectedJd.id}</span>
                      <span className="text-slate-400 text-xs font-bold flex items-center">
                        <i className="far fa-clock mr-1.5"></i>
                        发布时间：{formatDate(selectedJd.created_at)}
                      </span>
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">{selectedJd.title}</h2>
                    {!selectedJd.is_active && selectedJd.close_reason && (
                      <div className="mt-4 p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                        <p className="text-xs font-black text-orange-600 uppercase tracking-widest mb-1">关闭理由</p>
                        <p className="text-sm text-orange-700 font-medium">{selectedJd.close_reason}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-3">
                    {selectedJd.is_active && selectedJd.current_hired_count < selectedJd.requirement_count && (
                      <>
                        <button 
                          id="start-match-btn"
                          onClick={() => handleMatch(false)}
                          disabled={isMatching}
                          className={`px-5 py-2.5 rounded-2xl flex items-center space-x-2 transition-all shadow-sm font-bold text-sm ${
                            showMatchingSidePanel 
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200' 
                              : 'bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50'
                          }`}
                        >
                          <i className={`fas ${isMatching ? 'fa-spinner fa-spin' : 'fa-magic'}`}></i>
                          <span>{isMatching ? '正在匹配' : '人才匹配'}</span>
                        </button>
                        <button 
                          onClick={() => handleGoToEdit(selectedJd)}
                          className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl flex items-center space-x-2 text-slate-600 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm font-bold text-sm"
                        >
                          <i className="fas fa-edit"></i>
                          <span>编辑职位</span>
                        </button>
                        <button 
                          onClick={() => setIsClosing(true)}
                          className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl flex items-center space-x-2 text-slate-600 hover:text-orange-600 hover:border-orange-100 hover:bg-orange-50 transition-all shadow-sm font-bold text-sm"
                        >
                          <i className="fas fa-power-off"></i>
                          <span>关闭职位</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                        <i className="fas fa-users text-xs"></i>
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">需求总数</p>
                    </div>
                    <p className="text-3xl font-black text-slate-800">{selectedJd.requirement_count}</p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                        <i className="fas fa-user-check text-xs"></i>
                      </div>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">已入职</p>
                    </div>
                    <p className="text-3xl font-black text-indigo-600">{selectedJd.current_hired_count}</p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">
                        <i className="fas fa-hourglass-half text-xs"></i>
                      </div>
                      <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">剩余需求</p>
                    </div>
                    <p className="text-3xl font-black text-orange-600">
                      {Math.max(0, selectedJd.requirement_count - selectedJd.current_hired_count)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-10 space-y-8 border-t border-slate-50">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">已入职人员 ({hiredCandidates.length})</h4>
                  {hiredCandidates.length > 0 && (
                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                      点击人员姓名查看面试记录
                    </span>
                  )}
                </div>
                
                {hiredCandidates.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {hiredCandidates.map((candidate) => (
                      <div 
                        key={candidate.id}
                        onClick={() => onViewEvaluations?.(candidate.id)}
                        className="flex items-center space-x-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 hover:bg-white hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/5 transition-all cursor-pointer group"
                      >
                        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          {candidate.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{candidate.name}</p>
                          <p className="text-xs text-slate-400 font-medium">{candidate.email || '暂无邮箱'}</p>
                        </div>
                        <i className="fas fa-chevron-right text-slate-300 group-hover:text-indigo-400 transition-colors text-xs"></i>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-slate-50/30 rounded-3xl border border-dashed border-slate-200">
                    <i className="fas fa-user-friends text-3xl text-slate-200 mb-3 block"></i>
                    <p className="text-slate-400 font-bold">暂无已入职人员</p>
                  </div>
                )}
              </div>

              <div className="p-10 space-y-6 border-t border-slate-50">
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">职位详情描述</h4>
                <div className="prose prose-slate max-w-none markdown-content bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100/50">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedJd.description || '*该职位暂无详细描述*'}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>

        {/* 右侧匹配浮窗 (半盖效果) */}
        {showMatchingSidePanel && (
          <>
            {/* 背景遮罩，点击可关闭 */}
            <div 
              className="fixed inset-0 bg-slate-900/10 backdrop-blur-[2px] z-40 animate-in fade-in duration-300"
              onClick={() => setShowMatchingSidePanel(false)}
            ></div>
            
            {/* 浮动面板 */}
            <div className="fixed top-20 right-8 bottom-8 w-[60%] bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl z-50 animate-in slide-in-from-right-8 duration-500 flex flex-col overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div>
                  <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">候选人智能匹配</h4>
                  <p className="text-xs text-slate-400 mt-1 font-bold">基于 AI 算法为该职位推荐的最佳人才</p>
                </div>
                <div className="flex items-center space-x-3">
                  {matchingResults.length > 0 && !isMatching && (
                    <button 
                      onClick={() => handleMatch(true)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-indigo-100 text-indigo-600 hover:bg-indigo-50 transition-all flex items-center space-x-2 shadow-sm"
                    >
                      <i className="fas fa-sync-alt"></i>
                      <span>重新匹配</span>
                    </button>
                  )}
                  <button 
                    onClick={() => setShowMatchingSidePanel(false)}
                    className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {isMatching ? (
                  <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                      <i className="fas fa-magic absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600"></i>
                    </div>
                    <p className="text-sm font-bold text-slate-400">正在分析候选人与职位的契合度...</p>
                  </div>
                ) : matchingResults.length > 0 ? (
                  <div className="space-y-6">
                    {/* 筛选器 */}
                    <div className="flex items-center space-x-2 mb-6 bg-slate-50 p-1.5 rounded-2xl w-fit">
                      <button 
                        onClick={() => setMatchFilter('all')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${matchFilter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        全部结果
                      </button>
                      <button 
                        onClick={() => setMatchFilter('not_interviewed')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${matchFilter === 'not_interviewed' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        未面试
                      </button>
                      <button 
                        onClick={() => setMatchFilter('interviewed')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${matchFilter === 'interviewed' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        已面试
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {matchingResults
                        .filter(result => {
                          if (matchFilter === 'all') return true;
                          const candidate = candidates.find(c => c.id.toString() === result.id);
                          const candidateInterviews = interviews.filter(i => String(i.candidate_id) === result.id);
                          const isForThisJob = candidate?.job_id === selectedJd.id;
                          const hasInterviewForThisJob = isForThisJob && candidateInterviews.length > 0;
                          return matchFilter === 'interviewed' ? hasInterviewForThisJob : !hasInterviewForThisJob;
                        })
                        .map((result) => {
                          const candidate = candidates.find(c => c.id.toString() === result.id);
                          if (!candidate) return null;
                          
                          // 获取针对该岗位的面试记录
                          const candidateInterviews = interviews.filter(i => String(i.candidate_id) === result.id);
                          // 只有当候选人的 job_id 与当前 JD 匹配时，才认为面试是针对该岗位的
                          const isForThisJob = candidate.job_id === selectedJd.id;
                          const lastInterview = isForThisJob ? candidateInterviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] : null;
                          
                          // 检查是否正在面试中（包括 pending, accepted, preparing, in_progress, pending_decision）
                          const isInterviewing = candidate.status === 'interviewing' || 
                                              (lastInterview && ['pending', 'accepted', 'preparing', 'in_progress', 'pending_decision'].includes(lastInterview.status));

                          return (
                            <div key={result.id} className="bg-slate-50/50 rounded-[2rem] border border-slate-100 p-6 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/10 transition-all group border-l-4 border-l-transparent hover:border-l-indigo-500">
                              <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center space-x-4">
                                  <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm">
                                    {candidate.name[0]}
                                  </div>
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <h5 className="text-base font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{candidate.name}</h5>
                                      {(lastInterview || candidate.status === 'interviewing') && (
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                          lastInterview?.hiring_decision === 'reject' ? 'bg-rose-100 text-rose-600' :
                                          lastInterview?.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                                          'bg-blue-100 text-blue-600'
                                        }`}>
                                          {lastInterview?.hiring_decision === 'reject' ? '不合适' : 
                                           lastInterview?.status === 'completed' ? '面试完成' : '面试中'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center space-x-2 mt-1">
                                      <div className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[10px] font-black">
                                        {result.score}% 匹配度
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-bold">{candidate.education}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex space-x-2">
                              <button 
                                onClick={() => onViewCandidate?.(candidate.id.toString(), {
                                  score: result.score,
                                  analysis: result.analysis,
                                  matching_points: result.matching_points,
                                  mismatched_points: result.mismatched_points
                                })}
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-indigo-600 bg-white border border-indigo-50 hover:bg-indigo-50 transition-all shadow-sm"
                                title="查看详情"
                              >
                                <i className="fas fa-eye text-sm"></i>
                              </button>
                                  <button 
                                    onClick={() => handleOpenAssignModal(candidate)}
                                    disabled={isInterviewing}
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg ${
                                      isInterviewing 
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                                    }`}
                                    title={isInterviewing ? "面试进行中，无法重复分配" : "分配面试官"}
                                  >
                                    <i className={`fas ${isInterviewing ? 'fa-lock' : 'fa-user-plus'} text-sm`}></i>
                                  </button>
                                </div>
                          </div>
                          
                          <div className="bg-white/50 rounded-2xl p-4 mb-6 border border-slate-100/50">
                            <p className="text-xs text-slate-600 leading-relaxed italic font-medium">
                              "{result.analysis}"
                            </p>
                          </div>

                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              {result.matching_points.map((point, i) => (
                                <span key={i} className="px-3 py-1 rounded-lg bg-green-50 text-green-600 text-[10px] font-bold border border-green-100 flex items-center">
                                  <i className="fas fa-check-circle mr-1.5 opacity-70"></i>
                                  {point}
                                </span>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {result.mismatched_points.map((point, i) => (
                                <span key={i} className="px-3 py-1 rounded-lg bg-orange-50 text-orange-600 text-[10px] font-bold border border-orange-100 flex items-center">
                                  <i className="fas fa-exclamation-circle mr-1.5 opacity-70"></i>
                                  {point}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                ) : (
                  <div className="text-center py-32 bg-slate-50/30 rounded-[3rem] border-2 border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                      <i className="fas fa-magic text-4xl"></i>
                    </div>
                    <p className="text-slate-400 font-black text-lg">暂无匹配建议</p>
                    <p className="text-slate-300 text-sm mt-2 font-bold">请确保人才库中有符合条件的候选人</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* 关闭职位理由弹窗 */}
        {isClosing && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800">说明关闭理由</h3>
                <button 
                  onClick={() => {
                    setIsClosing(false);
                    setCloseReasonInput('');
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              <div className="space-y-6">
                <p className="text-sm text-slate-500 font-medium">关闭职位后将无法再匹配候选人，请说明关闭的原因（如：已招到人、项目取消等）。</p>
                <div className="relative">
                  <textarea
                    value={closeReasonInput}
                    onChange={(e) => setCloseReasonInput(e.target.value)}
                    placeholder="请输入关闭理由..."
                    className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300 resize-none"
                  ></textarea>
                  <div className="absolute bottom-3 right-3 text-[10px] font-bold text-slate-400">
                    {closeReasonInput.trim().length} 字
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <button 
                    onClick={() => {
                      setIsClosing(false);
                      setCloseReasonInput('');
                    }}
                    className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all border border-slate-100"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleCloseConfirm}
                    disabled={!closeReasonInput.trim()}
                    className="flex-1 bg-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-700 shadow-lg shadow-orange-100 transition-all disabled:opacity-50 disabled:shadow-none"
                  >
                    确认关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 分配面试官弹窗 */}
        {showInterviewerModal && selectedCandidateForInterview && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">分配面试官</h3>
                  <p className="text-sm text-slate-400 mt-1 font-bold">为 {selectedCandidateForInterview.name} 安排面试</p>
                </div>
                <button 
                  onClick={() => {
                    setShowInterviewerModal(false);
                    setSelectedInterviewerId(null);
                  }}
                  className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              <div className="space-y-8">
                <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100/50 flex items-center space-x-4">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl font-black shadow-lg shadow-indigo-200">
                    {selectedCandidateForInterview.name[0]}
                  </div>
                  <div>
                    <p className="font-black text-slate-800">{selectedCandidateForInterview.name}</p>
                    <p className="text-xs text-indigo-600 font-bold mt-0.5">申请职位：{selectedJd?.title}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">选择面试官</label>
                  <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {interviewerList.length > 0 ? (
                      interviewerList.map((interviewer) => (
                        <button
                          key={interviewer.id}
                          onClick={() => setSelectedInterviewerId(interviewer.id)}
                          className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${
                            selectedInterviewerId === interviewer.id
                              ? 'bg-indigo-50 border-indigo-500 shadow-md'
                              : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center space-x-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                              selectedInterviewerId === interviewer.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                            }`}>
                              {interviewer.full_name[0]}
                            </div>
                            <div className="text-left">
                              <p className={`font-bold ${selectedInterviewerId === interviewer.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                                {interviewer.full_name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium">{interviewer.department || '技术部'}</p>
                            </div>
                          </div>
                          {selectedInterviewerId === interviewer.id && (
                            <i className="fas fa-check-circle text-indigo-600 text-lg"></i>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-10 text-slate-400 italic">
                        暂无可用面试官
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-4 pt-4">
                  <button 
                    onClick={() => {
                      setShowInterviewerModal(false);
                      setSelectedInterviewerId(null);
                    }}
                    className="flex-1 px-8 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all border border-slate-100"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleAssignInterviewer}
                    disabled={!selectedInterviewerId || isAssigning}
                    className="flex-1 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center space-x-2"
                  >
                    {isAssigning ? (
                      <><i className="fas fa-spinner fa-spin"></i><span>正在分配...</span></>
                    ) : (
                      <><i className="fas fa-user-check"></i><span>确认分配</span></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 3. 编辑/创建视图
  const renderEditView = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={() => setViewMode(selectedJd ? 'detail' : 'list')}
        className="flex items-center space-x-2 text-slate-400 hover:text-indigo-600 font-bold transition-colors group"
      >
        <i className="fas fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
        <span>取消并返回</span>
      </button>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
        <div className="p-10 border-b border-slate-50">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {viewMode === 'edit' ? '编辑职位需求' : '发布新职位'}
          </h2>
          <p className="text-slate-500 mt-2 font-medium">请填写职位的详细信息以开始招聘</p>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-10">
          <div className="grid grid-cols-4 gap-6">
            <div className="col-span-2 space-y-3">
              <label className="text-sm font-black text-slate-700 uppercase tracking-widest ml-1">职位名称</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-800 placeholder:text-slate-300"
                placeholder="例如：高级 Python 开发工程师"
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-black text-slate-700 uppercase tracking-widest ml-1">职位类别</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-800 appearance-none"
              >
                <option value="技术类">技术类</option>
                <option value="市场运营类">市场运营类</option>
                <option value="行政财务类">行政财务类</option>
                <option value="产品类">产品类</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-black text-slate-700 uppercase tracking-widest ml-1">需求人数</label>
              <input
                type="number"
                min="1"
                required
                value={formData.requirement_count}
                onChange={(e) => setFormData({...formData, requirement_count: parseInt(e.target.value)})}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-800"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-black text-slate-700 uppercase tracking-widest">职位描述 (Markdown)</label>
                <button
                  type="button"
                  onClick={handleSmartGenerate}
                  disabled={isGenerating}
                  className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-all flex items-center shadow-sm border border-indigo-100"
                >
                  {isGenerating ? (
                    <><i className="fas fa-spinner fa-spin mr-1.5"></i> AI 正在构思...</>
                  ) : (
                    <><i className="fas fa-wand-magic-sparkles mr-1.5"></i> AI 智能润色/生成</>
                  )}
                </button>
              </div>
              <button 
                type="button"
                onClick={() => setIsPreview(!isPreview)}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                  isPreview 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {isPreview ? '查看编辑' : '实时预览'}
              </button>
            </div>
            
            {isPreview ? (
              <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 min-h-[400px] prose prose-indigo max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {formData.description || '*暂无描述内容预览*'}
                </ReactMarkdown>
              </div>
            ) : (
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full h-[500px] px-8 py-6 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300 resize-none"
                placeholder="请输入详细的职位描述、任职要求等..."
              ></textarea>
            )}
          </div>

          <div className="flex pt-6">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200"
            >
              {viewMode === 'edit' ? '保存职位变更' : '立即发布职位'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-20">
      {viewMode === 'list' && renderListView()}
      {viewMode === 'detail' && renderDetailView()}
      {(viewMode === 'edit' || viewMode === 'create') && renderEditView()}
    </div>
  );
};

export default JobDescriptionManager;
