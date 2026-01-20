
import React, { useState } from 'react';
import axios from 'axios';
import { geminiService } from '../services/geminiService';
import { Candidate } from '../types';

const ResumeAnalyzer: React.FC = () => {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [candidate, setCandidate] = useState<Partial<Candidate> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleParse = async () => {
    if (!text.trim()) return;
    setParsing(true);
    try {
      const result = await geminiService.parseResume(text);
      if (result.is_resume === false) {
        alert(result.summary || "检测到输入内容可能不是有效的简历，请提供包含个人经历和职业信息的文本。");
        setParsing(false);
        return;
      }
      setCandidate(result);
      setText(''); // 解析成功后清空文本框
      setIsEditing(false); // 重置编辑状态
    } catch (error) {
      console.error(error);
      alert("简历解析失败，请检查输入。");
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    if (!candidate) return;
    try {
      // 构造符合后端 CandidateCreate 架构的对象
      const saveData = {
        name: candidate.name || '未知',
        email: candidate.email || '',
        phone: candidate.phone || '',
        education: candidate.education_summary || candidate.education || '',
        experience: candidate.experience_list || [],
        projects: candidate.projects || [],
        skills: candidate.skill_tags || [],
        summary: candidate.summary || '',
        education_summary: candidate.education_summary || '',
        experience_list: candidate.experience_list || [],
        skill_tags: candidate.skill_tags || [],
        parsing_score: candidate.parsing_score || 0,
        position: candidate.position || '研发',
        years_of_experience: candidate.years_of_experience || 0
      };

      await axios.post('http://localhost:8000/api/v1/candidates/', saveData);
      alert('成功存入人才库！');
      setCandidate(null); // 入库成功后清除解析出的简历数据
    } catch (error: any) {
      console.error('Save error:', error);
      if (error.response && error.response.status === 400) {
        alert(error.response.data.detail || '该人才已存在');
      } else {
        alert('保存失败，请检查后端服务是否启动。');
      }
    }
  };

  const updateCandidate = (field: keyof Candidate, value: any) => {
    if (!candidate) return;
    setCandidate({ ...candidate, [field]: value });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-black text-slate-800 mb-4 flex items-center">
          <i className="fas fa-magic text-indigo-600 mr-3"></i>
          AI 智能简历解析
        </h2>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          将简历原始内容（PDF、Word 或纯文本）粘贴至下方。RecruitAI 将利用 BERT+CRF 模型精准提取关键实体信息。
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在此粘贴简历文本内容..."
          className="w-full h-56 p-5 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-mono bg-slate-50/50 placeholder:text-slate-300"
        />

        <div className="mt-6 flex justify-between items-center">
          <div className="text-xs text-slate-400 font-medium italic">
            <i className="fas fa-shield-halved mr-1"></i> 符合 GDPR 数据隐私保护规范
          </div>
          <button
            onClick={handleParse}
            disabled={parsing || !text.trim()}
            className="bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-200 flex items-center"
          >
            {parsing ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                正在解析中...
              </>
            ) : (
              <>
                <i className="fas fa-bolt-lightning mr-2"></i>
                开始智能提取
              </>
            )}
          </button>
        </div>
      </div>

      {candidate && (
        <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-lg animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="flex justify-between items-start border-b border-slate-100 pb-8 mb-8">
            <div className="flex items-center space-x-5">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl font-black">
                {candidate.name?.[0] || '候'}
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <input
                    type="text"
                    value={candidate.name || ''}
                    onChange={(e) => updateCandidate('name', e.target.value)}
                    className="text-3xl font-black text-slate-800 border-b-2 border-indigo-500 focus:outline-none w-full"
                    placeholder="姓名"
                  />
                ) : (
                  <h3 className="text-3xl font-black text-slate-800">{candidate.name || '未提取到姓名'}</h3>
                )}
                <div className="flex space-x-6 mt-3 text-sm text-slate-500 font-medium">
                  <span className="flex items-center">
                    <i className="fas fa-envelope mr-2 text-indigo-400"></i>
                    {isEditing ? (
                      <input
                        type="text"
                        value={candidate.email || ''}
                        onChange={(e) => updateCandidate('email', e.target.value)}
                        className="border-b border-slate-300 focus:border-indigo-500 focus:outline-none"
                        placeholder="邮箱"
                      />
                    ) : (
                      candidate.email || '暂无邮箱'
                    )}
                  </span>
                  <span className="flex items-center">
                    <i className="fas fa-phone mr-2 text-indigo-400"></i>
                    {isEditing ? (
                      <input
                        type="text"
                        value={candidate.phone || ''}
                        onChange={(e) => updateCandidate('phone', e.target.value)}
                        className="border-b border-slate-300 focus:border-indigo-500 focus:outline-none"
                        placeholder="电话"
                      />
                    ) : (
                      candidate.phone || '暂无电话'
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-200">
              简历完整性 {candidate.parsing_score ?? 0}%
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <section>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">教育背景</h4>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  {isEditing ? (
                    <textarea
                      value={candidate.education_summary || ''}
                      onChange={(e) => updateCandidate('education_summary', e.target.value)}
                      className="w-full bg-transparent border-none focus:outline-none text-slate-800 font-bold leading-relaxed resize-none"
                      rows={2}
                    />
                  ) : (
                    <p className="text-slate-800 font-bold leading-relaxed">{candidate.education_summary || '未提取到教育信息'}</p>
                  )}
                </div>
              </section>

              <section>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">工作经历</h4>
                <ul className="space-y-4">
                  {isEditing ? (
                    <textarea
                      value={candidate.experience_list?.join('\n') || ''}
                      onChange={(e) => updateCandidate('experience_list', e.target.value.split('\n'))}
                      className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 text-slate-600 text-sm leading-relaxed font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      rows={6}
                      placeholder="每行一段工作经历..."
                    />
                  ) : (
                    <>
                      {candidate.experience_list?.map((exp, i) => (
                        <li key={i} className="flex items-start group">
                          <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 mr-4 flex-shrink-0 group-hover:scale-125 transition-transform"></div>
                          <span className="text-slate-600 text-sm leading-relaxed font-medium">{exp}</span>
                        </li>
                      ))}
                      {(!candidate.experience_list || candidate.experience_list.length === 0) && (
                        <li className="text-slate-400 text-sm italic">未提取到经历信息</li>
                      )}
                    </>
                  )}
                </ul>
              </section>
            </div>

            <div className="space-y-8">
              <section>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">项目经验</h4>
                <div className="space-y-4">
                  {isEditing ? (
                    <textarea
                      value={JSON.stringify(candidate.projects, null, 2) || '[]'}
                      onChange={(e) => {
                        try {
                          updateCandidate('projects', JSON.parse(e.target.value));
                        } catch (err) {
                          // Ignore invalid JSON while typing
                        }
                      }}
                      className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 text-slate-600 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      rows={6}
                      placeholder="JSON 格式的项目列表..."
                    />
                  ) : (
                    candidate.projects && candidate.projects.length > 0 ? (
                      candidate.projects.map((proj: any, i: number) => (
                        <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-slate-800 font-bold text-sm">{proj.name || (typeof proj === 'string' ? proj : '项目 ' + (i+1))}</p>
                          {proj.description && (
                            <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                              {Array.isArray(proj.description) ? proj.description[0] : proj.description}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-xs italic">未提取到项目经验</p>
                    )
                  )}
                </div>
              </section>

              <section>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">个人总结</h4>
                {isEditing ? (
                  <input
                    type="text"
                    value={candidate.skill_tags?.join('，') || ''}
                    onChange={(e) => updateCandidate('skill_tags', e.target.value.split(/[，,]/))}
                    className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 text-indigo-700 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="技能标签，用逗号分隔"
                  />
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {candidate.skill_tags?.map((skill, i) => (
                      <span key={i} className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-xl text-xs font-bold border border-indigo-100/50 hover:bg-indigo-100 transition-colors">
                        {skill}
                      </span>
                    ))}
                    {(!candidate.skill_tags || candidate.skill_tags.length === 0) && (
                      <span className="text-slate-400 text-sm italic">未提取到技能标签</span>
                    )}
                  </div>
                )}
              </section>

              <section>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">AI 简历画像</h4>
                <div className="relative">
                  <div className="absolute -top-2 -left-2 text-indigo-200 text-3xl opacity-50"><i className="fas fa-quote-left"></i></div>
                  {isEditing ? (
                    <textarea
                      value={candidate.summary || ''}
                      onChange={(e) => updateCandidate('summary', e.target.value)}
                      className="w-full text-slate-600 text-sm font-medium leading-relaxed bg-indigo-50/30 p-6 rounded-2xl border border-indigo-100/30 italic focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      rows={4}
                    />
                  ) : (
                    <p className="text-slate-600 text-sm font-medium leading-relaxed bg-indigo-50/30 p-6 rounded-2xl border border-indigo-100/30 italic">
                      {candidate.summary || 'AI 正在分析该候选人的核心价值主张...'}
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center">
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`${isEditing ? 'text-indigo-600' : 'text-slate-400'} text-sm font-bold hover:text-slate-800 transition-colors flex items-center group`}
            >
              <i className={`fas ${isEditing ? 'fa-check-circle' : 'fa-pen-to-square'} mr-2 group-hover:rotate-12 transition-transform`}></i> 
              {isEditing ? '完成修正' : '修正解析数据'}
            </button>
            <div className="flex space-x-4">
              <button className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
                导出 PDF
              </button>
              <button 
                onClick={handleSave}
                className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
              >
                入库人才库
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeAnalyzer;
