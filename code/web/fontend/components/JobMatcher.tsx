
import React, { useState } from 'react';
import { geminiService } from '../services/geminiService';
import { Candidate } from '../types';

const mockCandidates: Candidate[] = [
  {
    id: '1',
    name: '张晓雅',
    email: 'xiaoya.z@example.com',
    phone: '138-1234-5678',
    education: '斯坦福大学, 计算机科学硕士',
    experience: ['谷歌资深工程师 (2020-2024): 负责搜索后端架构优化', '知名初创公司全栈开发负责人 (2018-2020): 从0到1构建产品'],
    skills: ['React', 'Node.js', 'PyTorch', '系统架构设计', 'Go', 'Kubernetes'],
    summary: '精通大规模后端系统构建与现代前端框架，具有极强的架构规划能力，在分布式系统和 AI 工程化方面有深厚积淀。'
  },
  {
    id: '2',
    name: '陈志远',
    email: 'zy.chen@example.com',
    phone: '139-8765-4321',
    education: '北京大学, 信息管理学士',
    experience: ['腾讯高级产品设计师 (2021-2023): 主导社交产品交互迭代', '金融科技独角兽 UI/UX 负责人 (2019-2021): 提升支付流程转化率'],
    skills: ['Figma', 'React', '动效设计', '用户研究', 'Design System', 'Prototyping'],
    summary: '设计驱动型工程师，专注于构建极致体验的数字化产品界面，擅长通过数据分析驱动交互决策。'
  }
];

interface JobMatcherProps {
  onStartInterview: (candidate: Candidate, interviewId?: number) => void;
}

const JobMatcher: React.FC<JobMatcherProps> = ({ onStartInterview }) => {
  const [jd, setJd] = useState('');
  const [matching, setMatching] = useState(false);
  const [results, setResults] = useState<{ id: string; score: number; analysis: string }[]>([]);
  const [viewingCandidate, setViewingCandidate] = useState<Candidate | null>(null);

  const handleMatch = async () => {
    if (!jd.trim()) return;
    setMatching(true);
    setViewingCandidate(null); // 清除当前的详情查看
    try {
      const matchResults = await Promise.all(
        mockCandidates.map(async (c) => {
          const res = await geminiService.matchCandidate(c, jd);
          return { id: c.id, ...res };
        })
      );
      setResults(matchResults.sort((a, b) => b.score - a.score));
    } catch (e) {
      console.error(e);
    } finally {
      setMatching(false);
    }
  };

  const CandidateDetailView = ({ candidate }: { candidate: Candidate }) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100">
        <button 
          onClick={() => setViewingCandidate(null)}
          className="text-slate-400 hover:text-slate-600 transition-colors flex items-center text-sm font-bold"
        >
          <i className="fas fa-arrow-left mr-2"></i> 返回列表
        </button>
        <div className="flex space-x-3">
          <button 
            onClick={() => onStartInterview(candidate)}
            className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
          >
            发起面试
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-6 mb-10">
        <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl font-black text-indigo-600">
          {candidate.name[0]}
        </div>
        <div>
          <h3 className="text-3xl font-black text-slate-800">{candidate.name}</h3>
          <p className="text-slate-500 font-medium mt-1">{candidate.education}</p>
          <div className="flex space-x-4 mt-3">
            <span className="text-xs text-slate-400 font-medium"><i className="fas fa-envelope mr-1"></i> {candidate.email}</span>
            <span className="text-xs text-slate-400 font-medium"><i className="fas fa-phone mr-1"></i> {candidate.phone}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-8">
          <section>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">工作经历</h4>
            <div className="space-y-4">
              {candidate.experience.map((exp, i) => (
                <div key={i} className="flex space-x-3">
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">{exp}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
        <div className="space-y-8">
          <section>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">核心技能</h4>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((skill, i) => (
                <span key={i} className="bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-100">
                  {skill}
                </span>
              ))}
            </div>
          </section>
          <section>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">AI 画像评价</h4>
            <div className="p-5 bg-indigo-50/30 rounded-2xl border border-indigo-100/50">
              <p className="text-sm text-indigo-900 leading-relaxed italic font-medium">
                "{candidate.summary}"
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      {/* 左侧：岗位输入 */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm h-fit sticky top-24">
        <h2 className="text-xl font-black text-slate-800 mb-4 flex items-center">
          <i className="fas fa-file-contract text-indigo-600 mr-3"></i>
          岗位需求 (JD)
        </h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          请输入您的岗位描述，AI 将基于语义理解模型进行人岗匹配分析。
        </p>
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="在此处输入详细的任职资格、岗位职责等内容..."
          className="w-full h-80 p-5 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm leading-relaxed bg-slate-50/30"
        />
        <button
          onClick={handleMatch}
          disabled={matching || !jd.trim()}
          className="w-full mt-6 bg-indigo-600 text-white py-4 rounded-xl font-black hover:bg-indigo-700 transition-all flex justify-center items-center shadow-xl shadow-indigo-100"
        >
          {matching ? (
            <><i className="fas fa-spinner fa-spin mr-3"></i> 正在进行深度语义匹配...</>
          ) : (
            <><i className="fas fa-brain mr-3"></i> 开始精准人岗匹配</>
          )}
        </button>
      </div>

      {/* 右侧：列表或详情 */}
      <div className="space-y-6">
        {viewingCandidate ? (
          <CandidateDetailView candidate={viewingCandidate} />
        ) : (
          <>
            <div className="flex justify-between items-end mb-2">
              <h2 className="text-xl font-black text-slate-800">候选人适配排行</h2>
              <span className="text-xs text-slate-400 font-medium">共分析 2 位候选人</span>
            </div>
            
            {results.length === 0 && !matching && (
              <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <i className="fas fa-magnifying-glass text-slate-300 text-2xl"></i>
                </div>
                <p className="text-slate-400 font-medium">输入岗位 JD 并启动分析以查看匹配评分</p>
              </div>
            )}
            
            {results.map((res) => {
              const candidate = mockCandidates.find(c => c.id === res.id);
              if (!candidate) return null;
              
              return (
                <div key={res.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all animate-in fade-in slide-in-from-right-6 duration-500 group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center">
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-lg mr-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        {candidate.name[0]}
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 text-lg">{candidate.name}</h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{candidate.education}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-black tracking-tight ${res.score > 75 ? 'text-green-600' : res.score > 50 ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {res.score}<span className="text-sm ml-0.5">%</span>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">匹配指数</p>
                    </div>
                  </div>

                  <div className="p-5 bg-indigo-50/30 rounded-2xl border border-indigo-100/30 mb-6">
                    <div className="flex items-center mb-2 text-indigo-600">
                      <i className="fas fa-wand-magic-sparkles text-xs mr-2"></i>
                      <span className="text-[10px] font-black uppercase tracking-wider">AI 匹配深度解析</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium line-clamp-2">
                      {res.analysis}
                    </p>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button 
                      onClick={() => setViewingCandidate(candidate)}
                      className="text-xs font-bold text-slate-600 px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      查看简历详情
                    </button>
                    <button 
                      onClick={() => onStartInterview(candidate)}
                      className="text-xs font-bold text-white px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 transition-all shadow-lg shadow-slate-100"
                    >
                      生成面试方案
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default JobMatcher;
