
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Candidate, User } from '../types';

interface TalentPoolProps {
  onSelectCandidate: (candidate: Candidate, interviewId?: number) => void;
  currentUser: User | null;
  onViewEvaluations?: (candidateId?: string) => void;
}

const TalentPool: React.FC<TalentPoolProps> = ({ onSelectCandidate, currentUser, onViewEvaluations }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('全部');
  const [expFilter, setExpFilter] = useState('全部');
  const [viewingCandidate, setViewingCandidate] = useState<Candidate | null>(null);
  const [talents, setTalents] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [interviewers, setInterviewers] = useState<User[]>([]);
  const [assigningTo, setAssigningTo] = useState<number | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [interviews, setInterviews] = useState<any[]>([]);

  const handleUpdateCandidateStatus = async (candidateId: string, status: string) => {
    console.log("谁调用的")
    try {
      await axios.put(`http://localhost:8000/api/v1/candidates/${candidateId}`, { status });
      
      // 同步更新本地状态，确保 UI 立即响应
      setTalents(prev => prev.map(t => t.id === candidateId ? { ...t, status } : t));
      setViewingCandidate(prev => {
        if (prev && prev.id === candidateId) {
          return { ...prev, status };
        }
        return prev;
      });

      // 后台刷新数据
      fetchTalents();
      fetchInterviews();
      
      alert('状态更新成功');
    } catch (error) {
      console.error('Error updating candidate status:', error);
      alert('状态更新失败');
    }
  };

  const fetchInterviews = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/v1/interviews/');
      setInterviews(response.data);
    } catch (error) {
      console.error('Error fetching interviews:', error);
    }
  };

  const fetchTalents = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/api/v1/candidates/');
      const mappedTalents = response.data.map((t: any) => {
        // 兼容不同的经历字段
        const experience = (t.experience && t.experience.length > 0) 
          ? t.experience 
          : (t.experience_list || []);
          
        return {
          ...t,
          id: String(t.id),
          name: t.name || '未知候选人',
          skills: t.skills || [],
          yearsOfExperience: t.years_of_experience || 0,
          position: t.position || '未指定',
          experience: experience,
          projects: t.projects || []
        };
      });
      setTalents(mappedTalents);
    } catch (error) {
      console.error('Error fetching talents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInterviewers = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/v1/users/?role=interviewer');
      setInterviewers(response.data);
    } catch (error) {
      console.error('Error fetching interviewers:', error);
    }
  };

  useEffect(() => {
    fetchTalents();
    fetchInterviewers();
    fetchInterviews();
  }, []);

  const handleAssignInterview = async (candidateId: string) => {
    if (!assigningTo) {
      alert('请选择面试官');
      return;
    }
    if (!currentUser) return;

    try {
      const response = await axios.post('http://localhost:8000/api/v1/interviews/', {
        candidate_id: parseInt(candidateId),
        interviewer_id: assigningTo,
        admin_id: currentUser.id,
        status: 'pending'
      });
      
      console.log('Assignment response:', response.data);
      alert('面试任务分配成功！');
      setShowAssignModal(false);
      setViewingCandidate(null);
      fetchInterviews();
    } catch (error: any) {
      console.error('Error assigning interview:', error);
      const detail = error.response?.data?.detail;
      alert(`分配失败: ${detail || '请重试'}`);
    }
  };

  const positions = ['全部', '研发', '设计', '算法', '财务'];
  const expRanges = ['全部', '3年以下', '3-5年', '5-10年', '10年以上'];

  const filteredTalents = talents.filter(t => {
    const nameStr = t.name || '';
    const searchLower = searchTerm.toLowerCase();
    const nameMatch = nameStr.toLowerCase().includes(searchLower);
    const skillsMatch = Array.isArray(t.skills) && t.skills.some(s => String(s).toLowerCase().includes(searchLower));
    
    const matchesSearch = nameMatch || skillsMatch;
    const matchesPosition = positionFilter === '全部' || t.position === positionFilter;
    
    let matchesExp = true;
    if (expFilter !== '全部') {
      const years = t.yearsOfExperience || 0;
      if (expFilter === '3年以下') matchesExp = years < 3;
      else if (expFilter === '3-5年') matchesExp = years >= 3 && years <= 5;
      else if (expFilter === '5-10年') matchesExp = years > 5 && years <= 10;
      else if (expFilter === '10年以上') matchesExp = years > 10;
    }
    
    return matchesSearch && matchesPosition && matchesExp;
  });

  const handleResign = (candidateId: string) => {
    if (!candidateId) return;
    if (window.confirm('确定要办理离职吗？离职后该候选人将回到人才库，原有的面试记录将不再作为录用依据。')) {
      handleUpdateCandidateStatus(candidateId, 'resigned');
    }
  };

  return (
    <div className="space-y-6">
      {viewingCandidate ? (
        <CandidateDetailView 
          candidate={viewingCandidate} 
          interviews={interviews}
          currentUser={currentUser}
          onBack={() => setViewingCandidate(null)}
          onViewEvaluations={onViewEvaluations}
          onUpdateStatus={handleUpdateCandidateStatus}
          onResign={handleResign}
          onAssignInterview={() => setShowAssignModal(true)}
          onSelectCandidate={onSelectCandidate}
        />
      ) : (
        <>
          {/* 筛选与搜索 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input 
                type="text"
                placeholder="搜索人才、技能或职位..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
            
            <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
              <select 
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
              >
                {positions.map(p => <option key={p} value={p}>{p === '全部' ? '所有职位' : p}</option>)}
              </select>
              
              <select 
                value={expFilter}
                onChange={(e) => setExpFilter(e.target.value)}
                className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
              >
                {expRanges.map(e => <option key={e} value={e}>{e === '全部' ? '所有经验' : e}</option>)}
              </select>
            </div>
          </div>

          {/* 人才列表 */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTalents.map(candidate => {
                const candidateInterviews = interviews.filter(i => String(i.candidate_id) === String(candidate.id));
                const activeInterview = candidateInterviews.find(i => ['pending', 'accepted', 'preparing', 'in_progress', 'pending_decision'].includes(i.status));
                const completedInterviews = candidateInterviews.filter(i => i.status === 'completed').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                
                // 计算面试状态
                let statusBadge = null;
                const lastInterview = completedInterviews[0];
                const lastDecision = lastInterview?.hiring_decision;

                if (candidate.status === 'hired') {
                  statusBadge = <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-[10px] font-bold">已录用</span>;
                } else if (candidate.status === 'rejected') {
                  statusBadge = <span className="bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-[10px] font-bold">已拒绝</span>;
                } else if (candidate.status === 'resigned') {
                  statusBadge = <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-bold">已离职</span>;
                } else if (candidate.status === 'interviewing') {
                  statusBadge = <span className="bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg text-[10px] font-bold">面试中</span>;
                } else if (activeInterview) {
                  const isInProgress = activeInterview.status === 'in_progress' || activeInterview.status === 'preparing' || activeInterview.status === 'accepted';
                  statusBadge = <span className={`border px-2.5 py-1 rounded-lg text-[10px] font-bold ${ 
                    isInProgress ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                    activeInterview.status === 'pending_decision' ? 'bg-purple-100 text-purple-700 border-purple-200' : 
                    'bg-indigo-100 text-indigo-700 border-indigo-200'
                  }`}>
                    {isInProgress ? '面试中' : 
                     activeInterview.status === 'pending_decision' ? '待评价' : '待接受'}
                  </span>;
                } else if (completedInterviews.length > 0) {
                  statusBadge = <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-bold">面试完成</span>;
                } else {
                  statusBadge = <span className="bg-slate-50 text-slate-400 border border-slate-100 px-2.5 py-1 rounded-lg text-[10px] font-bold">无</span>;
                }

                return (
                  <div 
                    key={candidate.id}
                    onClick={() => setViewingCandidate(candidate)}
                    className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300 cursor-pointer relative flex flex-col"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 text-xl font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        {candidate.name.charAt(0)}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">经验</span>
                        <span className="text-sm font-bold text-slate-700">{candidate.yearsOfExperience} 年</span>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-slate-800 mb-1">{candidate.name}</h3>
                    <p className="text-xs font-semibold text-slate-500 mb-2">{candidate.position}</p>

                    <div className="flex flex-wrap gap-1.5 mb-6 flex-1">
                      {candidate.skills.slice(0, 3).map(skill => (
                        <span key={skill} className="px-2.5 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-100">
                          {skill}
                        </span>
                      ))}
                      {candidate.skills.length > 3 && (
                        <span className="text-[10px] font-bold text-slate-300 self-center">+{candidate.skills.length - 3}</span>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex flex-col">
                        <div className="flex items-center text-slate-400 text-[10px] font-bold mb-1">
                          <i className="fas fa-graduation-cap mr-1.5"></i>
                          {candidate.education}
                        </div>
                        {candidateInterviews.length > 0 && (
                          <div 
                            className="text-[10px] font-bold text-indigo-500 hover:underline cursor-pointer flex items-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onViewEvaluations) onViewEvaluations(candidate.id);
                            }}
                          >
                            <i className="fas fa-history mr-1"></i> 面试记录: {candidateInterviews.length} 次
                          </div>
                        )}
                      </div>
                      <div>
                        {statusBadge || (
                          <span className="text-indigo-600 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                            查看详情 <i className="fas fa-arrow-right ml-1"></i>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 分配面试官弹窗 */}
      {showAssignModal && viewingCandidate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">分配面试任务</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-500 font-bold mr-4 shadow-sm">
                  {viewingCandidate.name.charAt(0)}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">候选人</p>
                  <p className="font-bold text-slate-800">{viewingCandidate.name}</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block ml-1">选择面试官</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {interviewers.map(interviewer => (
                    <div 
                      key={interviewer.id}
                      onClick={() => setAssigningTo(interviewer.id)}
                      className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                        assigningTo === interviewer.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 text-xs font-bold ${
                          assigningTo === interviewer.id ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {interviewer.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{interviewer.full_name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{interviewer.department}</p>
                        </div>
                      </div>
                      {assigningTo === interviewer.id && <i className="fas fa-check-circle text-indigo-500"></i>}
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => handleAssignInterview(viewingCandidate.id)}
                disabled={!assigningTo}
                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-lg shadow-indigo-100"
              >
                确认分配任务
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface CandidateDetailViewProps {
  candidate: Candidate;
  interviews: any[];
  currentUser: User | null;
  onBack: () => void;
  onViewEvaluations: (candidateId?: string) => void;
  onUpdateStatus: (candidateId: string, status: string) => void;
  onResign: (candidateId: string) => void;
  onAssignInterview: () => void;
  onSelectCandidate: (candidate: Candidate, interviewId?: number) => void;
}

const CandidateDetailView: React.FC<CandidateDetailViewProps> = ({ 
  candidate, 
  interviews, 
  currentUser, 
  onBack, 
  onViewEvaluations, 
  onUpdateStatus, 
  onResign, 
  onAssignInterview,
  onSelectCandidate
}) => {
  const candidateInterviews = interviews.filter(i => String(i.candidate_id) === String(candidate.id));
  const completedInterviews = candidateInterviews.filter(i => i.status === 'completed');
  const activeInterview = candidateInterviews.find(i => 
    ['pending', 'accepted', 'preparing', 'in_progress', 'pending_decision'].includes(i.status)
  );

  const getStatusText = (status: string) => {
    switch(status) {
      case 'pending': return '待接受';
      case 'accepted': return '待面试';
      case 'preparing': return '准备中';
      case 'in_progress': return '面试中';
      case 'pending_decision': return '待评价';
      case 'completed': return '已完成';
      default: return status;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
      <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <button 
          onClick={onBack}
          className="text-slate-500 hover:text-slate-800 transition-colors flex items-center text-sm font-semibold"
        >
          <i className="fas fa-arrow-left mr-2"></i> 返回人才列表
        </button>
        <div className="flex space-x-3">
          {candidateInterviews.length > 0 && (
            <button 
              onClick={() => onViewEvaluations(candidate.id)}
              className="bg-white text-slate-700 px-5 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all border border-slate-200 flex items-center shadow-sm"
            >
              <i className="fas fa-history mr-2 text-slate-400"></i> 面试记录
            </button>
          )}
          {currentUser?.role === 'admin' && (
            activeInterview ? (
              <div className="flex items-center bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-xs font-bold border border-amber-100">
                <i className="fas fa-lock mr-2"></i> {getStatusText(activeInterview.status)}
              </div>
            ) : (
              <>
                {currentUser?.role === 'admin' && 
                 !activeInterview && 
                 completedInterviews.length > 0 && 
                 candidate.status === 'none' && (
                  <>
                    <button 
                      onClick={() => onUpdateStatus(candidate.id, 'hired')}
                      className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
                    >
                      确认录用
                    </button>
                    <button 
                      onClick={() => onUpdateStatus(candidate.id, 'rejected')}
                      className="bg-rose-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-rose-700 transition-all shadow-md shadow-rose-100"
                    >
                      拒绝
                    </button>
                  </>
                )}
                {candidate.status === 'hired' && (
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onResign(candidate.id);
                    }}
                    className="bg-slate-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-all shadow-md shadow-slate-100"
                  >
                    离职
                  </button>
                )}
                {(candidate.status === 'none' || candidate.status === 'resigned' || candidate.status === 'rejected') && !activeInterview && (
                  <button 
                    onClick={onAssignInterview}
                    className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                  >
                    {candidate.status === 'resigned' ? '重新分配面试' : '分配面试官'}
                  </button>
                )}
              </>
            )
          )}
          {currentUser?.role === 'interviewer' && activeInterview && activeInterview.interviewer_id === currentUser.id && (
            <button 
              onClick={() => onSelectCandidate(candidate, activeInterview.id)}
              className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 flex items-center"
            >
              <i className="fas fa-play-circle mr-2"></i> 开始面试
            </button>
          )}
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-24 h-24 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 text-3xl font-bold mb-4">
              {candidate.name.charAt(0)}
            </div>
            <div className="flex flex-col items-center">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                {candidate.name}
                {candidate.status === 'hired' && (
                  <span className="ml-2 bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg text-[10px] font-bold">已录用</span>
                )}
                {candidate.status === 'rejected' && (
                  <span className="ml-2 bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-lg text-[10px] font-bold">已拒绝</span>
                )}
                {candidate.status === 'resigned' && (
                  <span className="ml-2 bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-lg text-[10px] font-bold">已离职</span>
                )}
                {candidate.status === 'interviewing' && (
                  <span className="ml-2 bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg text-[10px] font-bold">面试中</span>
                )}
                {candidate.status === 'none' && activeInterview && (
                  <span className={`ml-2 border px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                    activeInterview.status === 'in_progress' || activeInterview.status === 'preparing' || activeInterview.status === 'accepted'
                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                      : activeInterview.status === 'pending_decision'
                      ? 'bg-purple-100 text-purple-700 border-purple-200'
                      : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                  }`}>
                    {activeInterview.status === 'in_progress' || activeInterview.status === 'preparing' || activeInterview.status === 'accepted'
                      ? '面试中'
                      : activeInterview.status === 'pending_decision'
                      ? '待评价'
                      : '待接受'}
                  </span>
                )}
                {candidate.status === 'none' && !activeInterview && completedInterviews.length > 0 && (
                  <span className="ml-2 bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-lg text-[10px] font-bold">面试完成</span>
                )}
                {candidate.status === 'none' && !activeInterview && completedInterviews.length === 0 && (
                  <span className="ml-2 bg-slate-50 text-slate-400 border border-slate-100 px-2 py-0.5 rounded-lg text-[10px] font-bold">无</span>
                )}
              </h2>
              <p className="text-indigo-600 font-semibold mt-1">{candidate.position}</p>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="flex items-center text-slate-600 text-sm">
              <i className="fas fa-envelope w-5 text-slate-400"></i>
              <span className="ml-3 truncate">{candidate.email}</span>
            </div>
            <div className="flex items-center text-slate-600 text-sm">
              <i className="fas fa-phone w-5 text-slate-400"></i>
              <span className="ml-3">{candidate.phone}</span>
            </div>
            <div className="flex items-center text-slate-600 text-sm">
              <i className="fas fa-graduation-cap w-5 text-slate-400"></i>
              <span className="ml-3">{candidate.education}</span>
            </div>
            <div className="flex items-center text-slate-600 text-sm">
              <i className="fas fa-briefcase w-5 text-slate-400"></i>
              <span className="ml-3">{candidate.yearsOfExperience} 年工作经验</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-8">
          <section>
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
              个人简介
            </h3>
            <div className="text-slate-600 leading-relaxed bg-slate-50/50 p-6 rounded-xl border border-slate-100 italic">
              {candidate.summary}
            </div>
          </section>

          <section>
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
              核心技能
            </h3>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map(skill => (
                <span key={skill} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold border border-indigo-100">
                  {skill}
                </span>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
              工作经历
            </h3>
            <div className="space-y-4">
              {candidate.experience && candidate.experience.length > 0 ? (
                candidate.experience.map((exp: any, idx: number) => (
                  <div key={idx} className="flex items-start space-x-3 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">
                      {typeof exp === 'string' ? exp : (
                        <>
                          <span className="font-bold text-slate-800">{exp.company || ''}</span>
                          {exp.position && <span className="mx-2 text-indigo-500">· {exp.position}</span>}
                          {exp.period && <span className="ml-auto text-xs text-slate-400">({exp.period})</span>}
                          {exp.description && <p className="mt-2 text-xs text-slate-500">{exp.description}</p>}
                        </>
                      )}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 italic ml-4">暂无工作经历信息</p>
              )}
            </div>
          </section>

          {candidate.projects && candidate.projects.length > 0 && (
            <section>
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
                项目经验
              </h3>
              <div className="space-y-4">
                {candidate.projects.map((proj: any, idx: number) => (
                  <div key={idx} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-slate-800">{proj.name || (typeof proj === 'string' ? proj : '未命名项目')}</h4>
                      {proj.period && <span className="text-xs text-slate-400">({proj.period})</span>}
                    </div>
                    {proj.role && <p className="text-xs font-semibold text-indigo-500 mb-2">{proj.role}</p>}
                    <div className="text-sm text-slate-600 leading-relaxed">
                      {typeof proj === 'string' ? null : (
                        <>
                          {Array.isArray(proj.description) ? (
                            <ul className="list-disc list-inside space-y-1">
                              {proj.description.map((item: string, i: number) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>{proj.description}</p>
                          )}
                          {proj.technologies && proj.technologies.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {proj.technologies.map((tech: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 bg-white text-[10px] font-bold text-slate-400 rounded border border-slate-100 uppercase">
                                  {tech}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default TalentPool;
