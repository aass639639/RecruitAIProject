
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ResumeAnalyzer from './components/ResumeAnalyzer';
import InterviewAssistant from './components/InterviewAssistant';
import TalentPool from './components/TalentPool';
import MyInterviews from './components/MyInterviews';
import InterviewEvaluations from './components/InterviewEvaluations';
import KnowledgeBase from './components/KnowledgeBase';
import JobDescriptionManager from './components/JobDescriptionManager';
import Dashboard from './components/Dashboard';
import { Candidate, User } from './types';

type View = 'dashboard' | 'parse' | 'interview' | 'talent' | 'my-interviews' | 'evaluations' | 'knowledge-base' | 'jd-management';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedInterviewId, setSelectedInterviewId] = useState<number | null>(null);
  const [selectedInterviewIdForReport, setSelectedInterviewIdForReport] = useState<number | null>(null);
  const [preselectedCandidateId, setPreselectedCandidateId] = useState<string | null>(null);
  const [preselectedJdId, setPreselectedJdId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [navigationStack, setNavigationStack] = useState<View[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/v1/users/');
      setAvailableUsers(response.data);
      // Default to admin for now
      const admin = response.data.find((u: User) => u.username === 'admin');
      if (admin) setCurrentUser(admin);
    } catch (error) {
      console.error('Error fetching users:', error);
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

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard currentUser={currentUser} onNavigate={handleNavClick} />;
      case 'parse': return <ResumeAnalyzer />;
      case 'interview': return <InterviewAssistant candidate={selectedCandidate} interviewId={selectedInterviewId} onFinish={handleFinishInterview} />;
      case 'talent': return <TalentPool 
        onSelectCandidate={handleStartInterview} 
        currentUser={currentUser} 
        preselectedCandidateId={preselectedCandidateId}
        onClearPreselect={() => setPreselectedCandidateId(null)}
        onViewEvaluations={(cid) => {
          if (cid) setPreselectedCandidateId(cid);
          navigateTo('evaluations');
        }} 
      />;
      case 'my-interviews': return <MyInterviews onStartInterview={handleStartInterview} currentUser={currentUser} />;
      case 'evaluations': return <InterviewEvaluations 
        currentUser={currentUser} 
        preselectedCandidateId={preselectedCandidateId} 
        onClearPreselect={() => setPreselectedCandidateId(null)}
        initialSelectedInterviewId={selectedInterviewIdForReport}
        onClearInitialInterview={() => setSelectedInterviewIdForReport(null)}
        onBack={navigationStack.length > 0 ? goBack : undefined}
      />;
      case 'jd-management': return <JobDescriptionManager 
        currentUser={currentUser}
        initialJdId={preselectedJdId}
        onClearInitialJd={() => setPreselectedJdId(null)}
        onViewEvaluations={(cid, jid) => {
          if (cid) setPreselectedCandidateId(cid);
          if (jid) setPreselectedJdId(jid);
          navigateTo('evaluations');
        }}
        onViewCandidate={(cid) => {
          if (cid) setPreselectedCandidateId(cid);
          navigateTo('talent');
        }}
      />;
      case 'knowledge-base': return <KnowledgeBase />;
      default: return <TalentPool onSelectCandidate={handleStartInterview} currentUser={currentUser} onViewEvaluations={(cid) => {
        if (cid) setPreselectedCandidateId(cid);
        navigateTo('evaluations');
      }} />;
    }
  };

  const handleNavClick = (view: View, data?: any) => {
    setNavigationStack([]); // Clear history when clicking main nav
    if (view === 'evaluations' && data?.interviewId) {
      setSelectedInterviewIdForReport(data.interviewId);
    } else {
      setSelectedInterviewIdForReport(null);
    }
    
    if (view === 'jd-management' && data?.jdId) {
      setPreselectedJdId(data.jdId);
    } else if (view !== 'evaluations') {
      // 如果不是跳转到评价页（评价页可能需要保留 preselectedJdId），则清除
      // 实际上这里逻辑可以简化
    }

    setActiveView(view);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* 侧边栏 */}
      <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col hidden md:flex">
        <div className="p-8">
          <div className="flex items-center space-x-3 mb-10">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <i className="fas fa-robot text-white text-xl"></i>
            </div>
            <span className="text-2xl font-black text-white tracking-tight">RecruitAI</span>
          </div>
          
          <nav className="space-y-2">
            {filteredNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id as View)}
                className={`w-full flex items-center space-x-4 px-5 py-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeView === item.id 
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30' 
                    : 'hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <i className={`fas ${item.icon} w-5 text-center`}></i>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-800">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-2 px-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">切换角色 (演示用)</span>
            </div>
            <select 
              value={currentUser?.username || ''} 
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                const user = availableUsers.find((u: User) => u.username === e.target.value);
                if (user) {
                  setCurrentUser(user);
                  setActiveView('dashboard');
                }
              }}
              className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {availableUsers.map((u: User) => (
                <option key={u.id} value={u.username}>{u.full_name} ({u.role})</option>
              ))}
            </select>
            
            <div className="bg-slate-800/50 p-4 rounded-2xl flex items-center space-x-3 border border-slate-700/50">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex-shrink-0 flex items-center justify-center text-white font-bold">
                {currentUser?.full_name[0]}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{currentUser?.full_name}</p>
                <p className="text-xs text-slate-500 truncate">{currentUser?.department} · {currentUser?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-5 sticky top-0 z-40 hidden md:block">
          <div className="flex justify-between items-center max-w-7xl mx-auto">
            <h2 className="font-bold text-slate-500 uppercase text-xs tracking-[0.2em]">
              {navItems.find(n => n.id === activeView)?.label || (activeView === 'interview' ? 'AI 面试辅助' : '')}
            </h2>
            <div className="flex items-center space-x-6">
              {/* 移除通知和设置图标 */}
            </div>
          </div>
        </div>

        <div className="p-8 max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
