import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import { Interview, User, Candidate } from '../types';

interface MyInterviewsProps {
  currentUser: User | null;
  onStartInterview: (candidate: Candidate, interviewId?: number) => void;
}

const MyInterviews: React.FC<MyInterviewsProps> = ({ currentUser, onStartInterview }) => {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [editingDecision, setEditingDecision] = useState<'hire' | 'pass' | 'reject' | null>(null);
  const [editingNotes, setEditingNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedInterview) {
      setEditingDecision(selectedInterview.hiring_decision as any || null);
      setEditingNotes(selectedInterview.notes || '');
    }
  }, [selectedInterview]);

  const handleSaveDecision = async () => {
    if (!selectedInterview || !editingDecision) {
      alert('请选择录用结论');
      return;
    }

    setIsSaving(true);
    try {
      await axios.put(`http://localhost:8000/api/v1/interviews/${selectedInterview.id}`, {
        status: 'completed',
        hiring_decision: editingDecision,
        notes: editingNotes
      });

      // 同步更新候选人状态为 none
      if (selectedInterview.candidate_id) {
        await axios.put(`http://localhost:8000/api/v1/candidates/${selectedInterview.candidate_id}`, { status: 'none' });
      }

      alert('结论保存成功，面试已完成');
      setSelectedInterview(null);
      fetchMyInterviews();
    } catch (error) {
      console.error('Error saving decision:', error);
      alert('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchMyInterviews();
    }
  }, [currentUser]);

  const fetchMyInterviews = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:8000/api/v1/interviews/?interviewer_id=${currentUser?.id}`);
      // 按照创建时间降序排序
      const sortedInterviews = response.data.sort((a: Interview, b: Interview) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setInterviews(sortedInterviews);
    } catch (error) {
      console.error('Error fetching interviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: number, status: string, candidateId?: number) => {
    try {
      await axios.put(`http://localhost:8000/api/v1/interviews/${id}`, { status });
      
      // 如果状态变更为面试中，同步更新候选人状态
      if (status === 'in_progress' && candidateId) {
        await axios.put(`http://localhost:8000/api/v1/candidates/${candidateId}`, { status: 'interviewing' });
      }

      // 如果状态变更为已完成，同步更新候选人状态为 none
      if (status === 'completed' && candidateId) {
        await axios.put(`http://localhost:8000/api/v1/candidates/${candidateId}`, { status: 'none' });
      }
      
      fetchMyInterviews();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><i className="fas fa-spinner fa-spin text-3xl text-indigo-600"></i></div>;

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
                候选人: <span className="text-indigo-600 font-bold">{selectedInterview.candidate?.name}</span> · 
                面试日期: {new Date(selectedInterview.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <span className={`px-4 py-2 rounded-xl text-sm font-black uppercase ${
            selectedInterview.status === 'pending_decision' ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            {selectedInterview.status === 'pending_decision' ? '待评价' : '已完成'}
          </span>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧：基本信息与评价维度 */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">候选人画像</h3>
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-2xl">
                  {selectedInterview.candidate?.name[0]}
                </div>
                <div>
                  <p className="text-lg font-black text-slate-800">{selectedInterview.candidate?.name}</p>
                  <p className="text-sm text-slate-500">{selectedInterview.candidate?.position}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">评分维度</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedInterview.evaluation_criteria?.map((criteria, i) => (
                      <span key={i} className="text-[10px] font-bold bg-white text-indigo-600 border border-indigo-100 px-2 py-1 rounded-md">
                        {criteria}
                      </span>
                    )) || <span className="text-xs text-slate-400 italic">未记录评分维度</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">录用结论</h3>
              {selectedInterview.status === 'pending_decision' ? (
                <div className="space-y-3">
                  {[
                    { id: 'hire', label: '建议录用', icon: 'fa-user-check', color: 'emerald' },
                    { id: 'pass', label: '进入下一轮', icon: 'fa-arrow-right-to-bracket', color: 'indigo' },
                    { id: 'reject', label: '不建议录用', icon: 'fa-user-xmark', color: 'rose' }
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setEditingDecision(option.id as any)}
                      className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center space-x-3 ${
                        editingDecision === option.id
                          ? `bg-${option.color}-50 border-${option.color}-500 text-${option.color}-600 shadow-sm`
                          : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      <i className={`fas ${option.icon} text-lg`}></i>
                      <span className="font-bold">{option.label}</span>
                    </button>
                  ))}
                </div>
              ) : selectedInterview.hiring_decision ? (
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
              {selectedInterview.status === 'pending_decision' ? (
                <textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="请输入对候选人的综合评价..."
                  className="w-full h-48 p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm resize-none"
                />
              ) : (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-sm text-amber-900 leading-relaxed min-h-[150px] markdown-content">
                  {selectedInterview.notes ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedInterview.notes}
                    </ReactMarkdown>
                  ) : "未填写面试笔记"}
                </div>
              )}
              
              {selectedInterview.status === 'pending_decision' && (
                <button
                  onClick={handleSaveDecision}
                  disabled={isSaving || !editingDecision}
                  className="w-full mt-6 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSaving ? (
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                  ) : (
                    <i className="fas fa-check-circle mr-2"></i>
                  )}
                  保存并完成面试
                </button>
              )}
            </div>
          </div>

          {/* 右侧：面试题目详情 */}
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
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center">
                        <i className="fas fa-code mr-2 text-indigo-400"></i> 技术层面
                      </p>
                      <div className="text-xs text-slate-600 leading-relaxed markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {typeof selectedInterview.ai_evaluation.technical_evaluation === 'string'
                            ? selectedInterview.ai_evaluation.technical_evaluation
                            : (selectedInterview.ai_evaluation.technical_evaluation?.feedback || "")}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center">
                        <i className="fas fa-comment-alt mr-2 text-indigo-400"></i> 逻辑表达
                      </p>
                      <div className="text-xs text-slate-600 leading-relaxed markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {typeof selectedInterview.ai_evaluation.logical_evaluation === 'string'
                            ? selectedInterview.ai_evaluation.logical_evaluation
                            : (selectedInterview.ai_evaluation.logical_evaluation?.feedback || "")}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center">
                        <i className="fas fa-brain mr-2 text-indigo-400"></i> 思路清晰度
                      </p>
                      <div className="text-xs text-slate-600 leading-relaxed markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {typeof (selectedInterview.ai_evaluation as any).communication_evaluation === 'string'
                            ? (selectedInterview.ai_evaluation as any).communication_evaluation
                            : (selectedInterview.ai_evaluation.communication_evaluation?.feedback || (selectedInterview.ai_evaluation as any).clarity_evaluation?.feedback || (selectedInterview.ai_evaluation as any).clarity_evaluation || "")}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">面试题目及考察点</h3>
              <div className="space-y-8">
                {selectedInterview.questions && selectedInterview.questions.length > 0 ? (
                  selectedInterview.questions.map((q: any, index: number) => (
                    <div key={index} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center space-x-3">
                          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">
                            {index + 1}
                          </span>
                          <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg uppercase">
                            {q.category}
                          </span>
                          <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                            q.difficulty === '困难' ? 'bg-rose-50 text-rose-600' :
                            q.difficulty === '中等' ? 'bg-amber-50 text-amber-600' :
                            'bg-emerald-50 text-emerald-600'
                          }`}>
                            {q.difficulty}
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
                      <h4 className="text-lg font-bold text-slate-800 mb-4">{q.question}</h4>
                      {q.answer && (
                        <div className="mb-4 p-4 bg-indigo-50/30 rounded-xl border border-indigo-100/50 markdown-content">
                          <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">候选人回答</p>
                          <div className="text-sm text-slate-700 leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {q.answer}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">考察目的</p>
                          <p className="text-xs text-slate-600 leading-relaxed font-medium">{q.purpose}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">期望回答</p>
                          <p className="text-xs text-slate-600 leading-relaxed font-medium">{q.expected_answer}</p>
                        </div>
                      </div>
                      <div className="mb-4">
                        <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">出题依据</p>
                        <p className="text-xs text-indigo-800/70 italic font-medium leading-relaxed">
                          <i className="fas fa-quote-left text-[8px] mr-1 opacity-40"></i>
                          {q.source}
                          <i className="fas fa-quote-right text-[8px] ml-1 opacity-40"></i>
                        </p>
                      </div>
                      {q.notes && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <p className="text-[10px] font-black text-indigo-400 uppercase mb-2">面试评价</p>
                          <div className="text-sm text-slate-700 italic leading-relaxed bg-white p-4 rounded-xl border border-slate-50 markdown-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {q.notes}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10">
                    <i className="fas fa-clipboard-question text-slate-200 text-4xl mb-4"></i>
                    <p className="text-slate-400 italic">未记录面试题目</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-black text-slate-800">我的面试任务</h1>
        <p className="text-sm text-slate-500 mt-1">这里列出了分配给您的待面试候选人</p>
      </header>

      {interviews.length === 0 ? (
        <div className="bg-white rounded-3xl p-20 text-center border border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-calendar-xmark text-slate-300 text-3xl"></i>
          </div>
          <h3 className="text-xl font-bold text-slate-800">暂无面试任务</h3>
          <p className="text-slate-500 mt-2">当管理员为您分配新任务时，它们将显示在这里</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {interviews.map((interview) => (
            <div key={interview.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center space-x-6">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-2xl border border-indigo-100">
                    {interview.candidate?.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center space-x-3 mb-1">
                      <h3 className="text-xl font-black text-slate-800">{interview.candidate?.name}</h3>
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                        interview.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                        interview.status === 'accepted' ? 'bg-indigo-50 text-indigo-600' :
                        interview.status === 'preparing' ? 'bg-orange-50 text-orange-600' :
                        interview.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                        interview.status === 'in_progress' ? 'bg-blue-50 text-blue-600' :
                        interview.status === 'pending_decision' ? 'bg-purple-50 text-purple-600' :
                        'bg-emerald-50 text-emerald-600'
                      }`}>
                        {interview.status === 'pending' ? '待接受' : 
                         interview.status === 'accepted' ? '待面试' :
                         interview.status === 'preparing' ? '准备中' :
                         interview.status === 'rejected' ? '已拒绝' :
                         interview.status === 'in_progress' ? '面试中' : 
                         interview.status === 'pending_decision' ? '待评价' : '已完成'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 font-medium">
                      {interview.candidate?.position} · {interview.candidate?.years_of_experience}年经验
                    </p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-xs text-slate-400"><i className="fas fa-clock mr-1"></i> 分配于 {new Date(interview.created_at).toLocaleDateString()}</span>
                      <span className="text-xs text-slate-400"><i className="fas fa-user-tie mr-1"></i> 分配人: {interview.admin?.full_name}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 w-full md:w-auto">
                  {interview.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleStatusUpdate(interview.id, 'accepted', interview.candidate_id)}
                        className="flex-1 md:flex-none bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                      >
                        接受面试
                      </button>
                      <button 
                        onClick={() => handleStatusUpdate(interview.id, 'rejected', interview.candidate_id)}
                        className="flex-1 md:flex-none bg-white border border-slate-200 text-rose-600 px-6 py-3 rounded-xl text-sm font-bold hover:bg-rose-50 transition-all"
                      >
                        拒绝
                      </button>
                    </>
                  )}
                  {(interview.status === 'in_progress' || interview.status === 'preparing' || interview.status === 'accepted') && (
                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={() => {
                          if (interview.candidate) {
                            onStartInterview(interview.candidate, interview.id);
                          }
                        }}
                        className="flex-1 md:flex-none bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center"
                      >
                        <i className="fas fa-play mr-2"></i> 
                        {interview.status === 'in_progress' ? '继续面试' : 
                          interview.status === 'preparing' ? '查看详情 / 进入工作台' : '开始面试'}
                      </button>
                    </div>
                  )}
                  {(interview.status === 'completed' || interview.status === 'pending_decision') && (
                    <button 
                      onClick={() => setSelectedInterview(interview)}
                      className="flex-1 md:flex-none bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all flex items-center"
                    >
                      <i className="fas fa-file-lines mr-2"></i> 
                      {interview.status === 'pending_decision' ? '填写结论报告' : '查看详情报告'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyInterviews;
