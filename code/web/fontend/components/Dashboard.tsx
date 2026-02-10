
import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface Notification {
  id: number;
  content: string;
  time: string;
  type: string;
  job_id?: number;
}

interface DashboardProps {
  currentUser: User | null;
  onNavigate: (view: any, data?: any) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ currentUser, onNavigate }) => {
  const isAdmin = currentUser?.role === 'admin';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:8000/api/v1/dashboard/notifications?user_id=${currentUser.id}`);
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [currentUser]);

  const handleNotificationClick = (n: Notification) => {
    if (!isAdmin) {
      // 面试官点击通知进入“我的面试”
      onNavigate('my-interviews');
    } else {
      // 管理员点击逻辑
      if (n.type === 'completed') {
        // 跳转到面试详情报告，并传递面试 ID
        onNavigate('evaluations', { interviewId: n.id });
      } else if (n.type === 'accepted' && n.job_id) {
        // 跳转到职位管理并展开对应的职位
        onNavigate('jd-management', { jdId: n.job_id });
      } else {
        onNavigate('talent');
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h1 className="text-3xl font-black text-slate-800">
          下午好，{currentUser?.full_name} 👋
        </h1>
        <p className="text-slate-500 mt-2 font-medium">欢迎回到 RecruitAI 智能招聘管理系统</p>
      </header>

      {isAdmin && (
        <section>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">快捷操作</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button 
              onClick={() => onNavigate('parse')}
              className="group p-8 bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-xl hover:border-indigo-500/30 hover:-translate-y-1 transition-all text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <i className="fas fa-file-import text-6xl text-indigo-600"></i>
              </div>
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <i className="fas fa-file-import text-xl"></i>
              </div>
              <h4 className="text-xl font-black text-slate-800 mb-2">人才录入</h4>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">利用 AI 智能解析单份或批量简历，快速填充人才库</p>
            </button>

            <button 
              onClick={() => onNavigate('jd-management')}
              className="group p-8 bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-xl hover:border-emerald-500/30 hover:-translate-y-1 transition-all text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <i className="fas fa-briefcase text-6xl text-emerald-600"></i>
              </div>
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <i className="fas fa-briefcase text-xl"></i>
              </div>
              <h4 className="text-xl font-black text-slate-800 mb-2">我要招聘</h4>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">管理职位描述 (JD)，开启招聘流程，精准匹配人才</p>
            </button>

            <button 
              onClick={() => onNavigate('knowledge-base')}
              className="group p-8 bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-xl hover:border-amber-500/30 hover:-translate-y-1 transition-all text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <i className="fas fa-book text-6xl text-amber-600"></i>
              </div>
              <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <i className="fas fa-book text-xl"></i>
              </div>
              <h4 className="text-xl font-black text-slate-800 mb-2">学习问答</h4>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">访问企业知识库，查看面试指南、技术规范及 AI 问答</p>
            </button>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">通知中心</h3>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-wider">最新动态</span>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden min-h-[200px] flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
              <i className="fas fa-circle-notch fa-spin text-3xl mb-4 text-indigo-500"></i>
              <p className="text-sm font-medium">正在获取最新动态...</p>
            </div>
          ) : notifications.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  onClick={() => handleNotificationClick(n)}
                  className="p-6 hover:bg-slate-50/50 transition-colors flex items-start space-x-4 cursor-pointer group"
                >
                  <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center transition-transform group-hover:scale-110 ${
                    n.type === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                    n.type === 'accepted' ? 'bg-indigo-50 text-indigo-600' :
                    n.type === 'rejected' ? 'bg-rose-50 text-rose-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    <i className={`fas ${
                      n.type === 'completed' ? 'fa-check-double' :
                      n.type === 'accepted' ? 'fa-calendar-check' :
                      n.type === 'rejected' ? 'fa-calendar-xmark' :
                      'fa-clock'
                    } text-sm`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 font-bold leading-relaxed mb-1">
                      {n.content}
                    </p>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{n.time}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                <i className="fas fa-bell-slash text-2xl text-slate-200"></i>
              </div>
              <p className="text-sm font-medium">暂无最新动态</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
