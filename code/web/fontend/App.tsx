
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ResumeAnalyzer from './components/ResumeAnalyzer';
import InterviewAssistant from './components/InterviewAssistant';
import TalentPool from './components/TalentPool';
import MyInterviews from './components/MyInterviews';
import InterviewEvaluations from './components/InterviewEvaluations';
import KnowledgeBase from './components/KnowledgeBase';
import JobDescriptionManager from './components/JobDescriptionManager';
import Dashboard from './components/Dashboard';
import AIAssistant from './components/AIAssistant';
import { Candidate, User, ChatMessage } from './types';

type View = 'dashboard' | 'parse' | 'interview' | 'talent' | 'my-interviews' | 'evaluations' | 'knowledge-base' | 'jd-management';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedInterviewId, setSelectedInterviewId] = useState<number | null>(null);
  const [selectedInterviewIdForReport, setSelectedInterviewIdForReport] = useState<number | null>(null);
  const [preselectedCandidateId, setPreselectedCandidateId] = useState<string | null>(null);
  const [preselectedMatchResult, setPreselectedMatchResult] = useState<any>(null);
  const [preselectedJdId, setPreselectedJdId] = useState<number | null>(null);
  const [preselectedStatusFilter, setPreselectedStatusFilter] = useState<'all' | 'active' | 'closed' | 'full' | null>(null);
  const [preselectedShowMatching, setPreselectedShowMatching] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [navigationStack, setNavigationStack] = useState<View[]>([]);
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignParams, setAssignParams] = useState<{candidateId: string, jobId: number, candidateName?: string}>({ candidateId: '', jobId: 0 });
  const [selectedInterviewerId, setSelectedInterviewerId] = useState<number | null>(null);
  const [preselectedInterviewSearch, setPreselectedInterviewSearch] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('recruit_ai_chat_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('recruit_ai_chat_history', JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsInitializing(true);
      console.log('App: Fetching users...');
      const response = await axios.get('http://localhost:8000/api/v1/users/');
      console.log('App: Users fetched:', response.data);
      setAvailableUsers(response.data);
      // Default to admin for now
      const admin = response.data.find((u: User) => u.username === 'admin');
      if (admin) {
        console.log('App: Setting default user to admin');
        setCurrentUser(admin);
      } else if (response.data.length > 0) {
        console.log('App: Admin not found, setting default user to first available user');
        setCurrentUser(response.data[0]);
      } else {
        console.warn('App: No users found in database');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: '首页', icon: 'fa-house', roles: ['admin', 'interviewer'] },
    { id: 'jd-management', label: 'JD管理', icon: 'fa-briefcase', roles: ['admin'] },
    { id: 'talent', label: '人才库', icon: 'fa-users', roles: ['admin'] },
    { id: 'parse', label: '简历解析', icon: 'fa-file-import', roles: ['admin'] },
    { id: 'my-interviews', label: '我的面试', icon: 'fa-calendar-check', roles: ['interviewer'] },
    { id: 'evaluations', label: '面试评价', icon: 'fa-file-signature', roles: ['admin'] },
    { id: 'knowledge-base', label: '知识库', icon: 'fa-book', roles: ['admin', 'interviewer'] },
  ];

  const filteredNavItems = navItems.filter(item => 
    currentUser && item.roles.includes(currentUser.role)
  );

  const handleStartInterview = (candidate: Candidate, interviewId?: number) => {
    setSelectedCandidate(candidate);
    if (interviewId) setSelectedInterviewId(interviewId);
    setActiveView('interview');
  };

  const handleFinishInterview = () => {
    setSelectedCandidate(null);
    setSelectedInterviewId(null);
    if (currentUser?.role === 'interviewer') {
      setActiveView('my-interviews');
    } else {
      setActiveView('evaluations');
    }
  };

  const navigateTo = (view: View) => {
    setNavigationStack(prev => [...prev, activeView]);
    setActiveView(view);
  };

  const goBack = () => {
    if (navigationStack.length > 0) {
      const prevView = navigationStack[navigationStack.length - 1];
      setNavigationStack(prev => prev.slice(0, -1));
      setActiveView(prevView);
    }
  };

  const handleAgentAction = useCallback(async (action: string, params: any) => {
    console.log('App: Agent Action received:', action, params);
    if (action === 'jd') {
      if (params.id !== undefined && params.id !== null) {
        setPreselectedJdId(params.id === 0 ? null : params.id);
      }
      if (params.status) {
        setPreselectedStatusFilter(params.status);
      }
      navigateTo('jd-management');
    } else if (action === 'candidate') {
      if (params.id !== undefined && params.id !== null) {
        const idStr = String(params.id);
        setPreselectedCandidateId(idStr === "0" ? null : idStr);
      }
      if (params.score !== undefined) {
        setPreselectedMatchResult({
          score: params.score,
          analysis: params.analysis || '',
          matching_points: params.matching_points || [],
          mismatched_points: params.mismatched_points || []
        });
      }
      navigateTo('talent');
    } else if (action === 'match') {
      if (params.id || params.jdId) {
        setPreselectedJdId(params.id || params.jdId);
        setPreselectedShowMatching(true);
        navigateTo('jd-management');
      }
    } else if (action === 'assign') {
      // 弹出分配面试官弹窗
      setAssignParams({
        candidateId: params.candidateId || params.candidate_id,
        jobId: params.jobId || params.jd_id,
        candidateName: params.candidateName || '选定候选人'
      });
      setShowAssignModal(true);
      setSelectedInterviewerId(null);
    } else if (action === 'interview_detail') {
      if (params.candidate_name) {
        setPreselectedInterviewSearch(params.candidate_name);
      }
      navigateTo('evaluations');
    }
  }, [activeView]);

  const handleClearPreselect = useCallback(() => {
    console.log('App: Clearing preselected state');
    setPreselectedCandidateId(null);
    setPreselectedMatchResult(null);
  }, []);

  const handleConfirmAssign = async () => {
    if (!selectedInterviewerId || !assignParams) return;
    
    setIsAssigning(true);
    try {
      // 1. 更新候选人状态和关联职位
      await axios.put(`http://localhost:8000/api/v1/candidates/${assignParams.candidateId}`, {
        job_id: assignParams.jobId,
        status: '面试中'
      });
      
      // 2. 创建面试记录并分配面试官
      await axios.post('http://localhost:8000/api/v1/interviews/', {
        candidate_id: assignParams.candidateId,
        interviewer_id: selectedInterviewerId,
        job_id: assignParams.jobId,
        status: '待面试',
        interview_date: new Date().toISOString()
      });
      
      alert('已成功分配面试官并创建面试任务');
      setShowAssignModal(false);
      setPreselectedCandidateId(assignParams.candidateId);
      setActiveView('talent');
    } catch (error) {
      console.error('分配失败:', error);
      alert('分配面试失败，请检查网络或后端服务');
    } finally {
      setIsAssigning(false);
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard currentUser={currentUser} onNavigate={handleNavClick} />;
      case 'parse': return <ResumeAnalyzer />;
      case 'interview': return <InterviewAssistant candidate={selectedCandidate} interviewId={selectedInterviewId} onFinish={handleFinishInterview} />;
      case 'talent': return <TalentPool 
        onSelectCandidate={handleStartInterview} 
        currentUser={currentUser} 
        preselectedCandidateId={preselectedCandidateId}
        preselectedMatchResult={preselectedMatchResult}
        onClearPreselect={handleClearPreselect}
        onViewEvaluations={(cid) => {
          if (cid) setPreselectedCandidateId(cid);
          navigateTo('evaluations');
        }} 
      />;
      case 'my-interviews': return <MyInterviews 
        currentUser={currentUser} 
        onStartInterview={handleStartInterview} 
      />;
      case 'evaluations': return <InterviewEvaluations 
        currentUser={currentUser}
        preselectedCandidateId={preselectedCandidateId}
        preselectedInterviewSearch={preselectedInterviewSearch}
        onClearPreselect={() => setPreselectedCandidateId(null)}
        onClearInterviewSearch={() => setPreselectedInterviewSearch(null)}
      />;
      case 'knowledge-base': return <KnowledgeBase />;
      case 'jd-management': return <JobDescriptionManager 
        currentUser={currentUser}
        initialJdId={preselectedJdId}
        initialStatusFilter={preselectedStatusFilter || undefined}
        initialShowMatching={preselectedShowMatching}
        onClearInitialJd={() => {
          setPreselectedJdId(null);
          setPreselectedStatusFilter(null);
          setPreselectedShowMatching(false);
        }}
        onViewEvaluations={(cid, jid) => {
          if (cid) setPreselectedCandidateId(cid);
          if (jid) setPreselectedJdId(jid);
          navigateTo('evaluations');
        }}
        onViewCandidate={(cid, matchResult) => {
          if (cid) setPreselectedCandidateId(cid);
          if (matchResult) setPreselectedMatchResult(matchResult);
          navigateTo('talent');
        }}
      />;
      default: return <Dashboard currentUser={currentUser} onNavigate={handleNavClick} />;
    }
  };

  const handleNavClick = (viewId: string) => {
    setActiveView(viewId as View);
  };

  const handleUserSelect = (user: User) => {
    setCurrentUser(user);
    setActiveView('dashboard');
    setIsUserListOpen(false);
  };

  if (isInitializing) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20 mb-6 animate-bounce">
          <i className="fa-solid fa-bolt-lightning text-white text-2xl"></i>
        </div>
        <div className="flex items-center space-x-3 text-slate-400">
          <i className="fa-solid fa-circle-notch fa-spin text-xl"></i>
          <span className="font-bold tracking-widest uppercase text-xs">正在初始化系统...</span>
        </div>
      </div>
    );
  }

  if (availableUsers.length === 0) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
          <i className="fa-solid fa-triangle-exclamation text-3xl"></i>
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">无法连接到服务器</h2>
        <p className="text-slate-500 max-w-md mb-8">
          系统无法获取用户列表，请确保后端服务（http://localhost:8000）已正常启动并可以访问。
        </p>
        <button 
          onClick={() => fetchUsers()}
          className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
        >
          重试连接
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-50">
        <div className="p-8 flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <i className="fa-solid fa-bolt-lightning text-white text-lg"></i>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">RecruitAI</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          {filteredNavItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
                activeView === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className={`fa-solid ${item.icon} w-5 text-center text-sm ${
                activeView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'
              }`}></i>
              <span className="font-semibold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto relative">
          {/* 用户选择列表弹出框 */}
          {isUserListOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-[60] animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="p-2 max-h-64 overflow-y-auto">
                <p className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-700/50 mb-1">选择切换用户</p>
                {availableUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-colors ${
                      currentUser?.id === user.id 
                        ? 'bg-blue-600 text-white' 
                        : 'hover:bg-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center border border-slate-600 overflow-hidden">
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                        alt="avatar" 
                      />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-xs font-bold truncate">{user.full_name}</p>
                      <p className={`text-[9px] uppercase font-black tracking-tight ${
                        currentUser?.id === user.id ? 'text-blue-100' : 'text-slate-500'
                      }`}>
                        {user.role === 'admin' ? '管理员' : '面试官'}
                      </p>
                    </div>
                    {currentUser?.id === user.id && (
                      <i className="fa-solid fa-check text-[10px]"></i>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div 
            onClick={() => setIsUserListOpen(!isUserListOpen)}
            className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 transition-all cursor-pointer group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border-2 border-slate-600 overflow-hidden group-hover:border-blue-500 transition-colors">
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.username || 'user'}`} 
                  alt="avatar" 
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">{currentUser?.full_name}</p>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{currentUser?.role === 'admin' ? '管理员' : '面试官'}</p>
              </div>
              <i className={`fa-solid fa-chevron-up text-slate-600 text-xs transition-transform duration-300 ${isUserListOpen ? 'rotate-180' : ''}`}></i>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-[250px] py-5 sticky top-0 z-40 hidden md:block flex-shrink-0">
          <div className="flex justify-between items-center w-full">
            <h2 className="font-bold text-slate-500 uppercase text-xs tracking-[0.2em]">
              {navItems.find(n => n.id === activeView)?.label || (activeView === 'interview' ? 'AI 面试辅助' : '')}
            </h2>
            <div className="flex items-center space-x-6">
              {/* 移除通知和设置图标 */}
            </div>
          </div>
        </div>

        <div className="px-[250px] py-8 w-full h-[calc(100vh-64px)] overflow-y-auto">
          {activeView === 'dashboard' ? (
            <div className="flex gap-8 h-full">
              {currentUser?.role === 'admin' ? (
                <>
                  <div className="flex-1 min-w-[500px] h-full hidden lg:block">
                    <AIAssistant 
                      mode="embedded" 
                      chatHistory={chatHistory} 
                      setChatHistory={setChatHistory} 
                      onAction={handleAgentAction}
                    />
                  </div>
                  <div className="w-[450px] flex-shrink-0 overflow-y-auto pr-4">
                    <Dashboard currentUser={currentUser} onNavigate={handleNavClick} />
                  </div>
                </>
              ) : (
                <div className="flex-1 overflow-y-auto pr-4">
                  <Dashboard currentUser={currentUser} onNavigate={handleNavClick} />
                </div>
              )}
            </div>
          ) : (
            renderContent()
          )}
        </div>
      </main>

      {/* AI Assistant Agent - Only show floating when NOT on dashboard AND user is admin */}
      {activeView !== 'dashboard' && currentUser?.role === 'admin' && (
        <AIAssistant 
          mode="floating" 
          chatHistory={chatHistory} 
          setChatHistory={setChatHistory} 
          onAction={handleAgentAction}
        />
      )}

      {/* 分配面试官弹窗 */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">分配面试官</h3>
                <p className="text-sm text-slate-400 mt-1 font-bold">为 {assignParams?.candidateName} 安排面试</p>
              </div>
              <button 
                onClick={() => setShowAssignModal(false)}
                className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">选择面试官</label>
                <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {availableUsers.filter(u => u.role === 'interviewer' || u.role === 'admin').map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedInterviewerId(user.id)}
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${
                        selectedInterviewerId === user.id
                          ? 'bg-blue-50 border-blue-500 shadow-md'
                          : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                          selectedInterviewerId === user.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600'
                        }`}>
                          {user.full_name[0]}
                        </div>
                        <div className="text-left">
                          <p className={`font-bold ${selectedInterviewerId === user.id ? 'text-blue-900' : 'text-slate-700'}`}>
                            {user.full_name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">{user.department || '技术部'}</p>
                        </div>
                      </div>
                      {selectedInterviewerId === user.id && (
                        <i className="fas fa-check-circle text-blue-600 text-lg"></i>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex space-x-4 pt-4">
                <button 
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-8 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all border border-slate-100"
                >
                  取消
                </button>
                <button 
                  onClick={handleConfirmAssign}
                  disabled={!selectedInterviewerId || isAssigning}
                  className="flex-[2] bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center space-x-2"
                >
                  {isAssigning ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      <span>正在处理...</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check"></i>
                      <span>确认分配</span>
                    </>
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

export default App;
