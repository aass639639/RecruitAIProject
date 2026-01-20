
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area 
} from 'recharts';
import { Metric } from '../types';

const data = [
  { name: '周一', 候选人: 45, 匹配数: 32 },
  { name: '周二', 候选人: 52, 匹配数: 41 },
  { name: '周三', 候选人: 38, 匹配数: 35 },
  { name: '周四', 候选人: 65, 匹配数: 58 },
  { name: '周五', 候选人: 48, 匹配数: 42 },
  { name: '周六', 候选人: 20, 匹配数: 15 },
  { name: '周日', 候选人: 15, 匹配数: 10 },
];

const metrics: Metric[] = [
  { label: '简历总数', value: '1,284', change: '+12%', icon: 'fa-users', color: 'blue' },
  { label: '解析准确率', value: '96.2%', change: '+2.4%', icon: 'fa-check-circle', color: 'green' },
  { label: '平均匹配精确度', value: '82%', change: '+5%', icon: 'fa-bullseye', color: 'indigo' },
  { label: '累计节省工时', value: '154', change: '+32%', icon: 'fa-clock', color: 'orange' },
];

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">招聘效能概览</h1>
          <p className="text-sm text-slate-500 mt-1">基于 AI 驱动的实时招聘数据统计</p>
        </div>
        <button className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center">
          <i className="fas fa-file-export mr-2"></i> 导出报表
        </button>
      </header>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl bg-${m.color}-50 text-${m.color}-600`}>
                <i className={`fas ${m.icon} text-xl`}></i>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${m.change.startsWith('+') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {m.change}
              </span>
            </div>
            <p className="text-sm text-slate-500 font-medium">{m.label}</p>
            <h3 className="text-3xl font-black text-slate-800 mt-2">{m.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 活跃度图表 */}
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold text-slate-800">招聘活跃度趋势</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-xs text-slate-500">
                <span className="w-3 h-3 bg-indigo-500 rounded-full mr-2"></span> 简历解析
              </div>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorCand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Area type="monotone" dataKey="候选人" stroke="#6366f1" fillOpacity={1} fill="url(#colorCand)" strokeWidth={4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 效率提升指标 */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-8">流程效率提升</h3>
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">简历初筛耗时</span>
                <div className="flex items-center text-green-600 text-sm font-black">
                  <i className="fas fa-arrow-down mr-1"></i> 52%
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full transition-all duration-1000" style={{ width: '52%' }}></div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">面试安排效率</span>
                <div className="flex items-center text-green-600 text-sm font-black">
                  <i className="fas fa-arrow-down mr-1"></i> 40%
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full transition-all duration-1000" style={{ width: '40%' }}></div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">入职周期缩短</span>
                <div className="flex items-center text-green-600 text-sm font-black">
                  <i className="fas fa-arrow-down mr-1"></i> 25%
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-indigo-400 h-full rounded-full transition-all duration-1000" style={{ width: '25%' }}></div>
              </div>
            </div>
          </div>

          <div className="mt-10 p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
            <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest mb-3 flex items-center">
              <i className="fas fa-sparkles mr-2"></i> AI 洞察
            </p>
            <p className="text-sm text-indigo-900 leading-relaxed font-medium">
              本周语义匹配精确度提升显著，主要得益于技术岗位的样本库扩充。初筛效率已突破 50% 预设目标。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
