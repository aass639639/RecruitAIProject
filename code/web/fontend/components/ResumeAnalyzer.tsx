
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { geminiService } from '../services/geminiService';
import { Candidate } from '../types';

interface BatchFile {
  file: File;
  status: 'pending' | 'uploading' | 'parsing' | 'success' | 'failed';
  error?: string;
  result?: Partial<Candidate>;
}

const ResumeAnalyzer: React.FC = () => {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [candidate, setCandidate] = useState<Partial<Candidate> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [projectsJson, setProjectsJson] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // 批量上传相关状态
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (candidate?.projects) {
      setProjectsJson(JSON.stringify(candidate.projects, null, 2));
    } else {
      setProjectsJson('[]');
    }
  }, [candidate]);

  const handleParse = async () => {
    if (!text.trim()) return;
    setParsing(true);
    setIsBatchMode(false);
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedTypes.includes(extension)) {
      alert('只支持 PDF, Word 或 TXT 格式的文件');
      return;
    }

    setIsBatchMode(false);
    setUploading(true);
    try {
      const result = await geminiService.uploadResume(file);
      if (result.is_resume === false) {
        alert(result.summary || "检测到上传的文件可能不是有效的简历，请确保文件包含个人经历和职业信息。");
        return;
      }
      setCandidate(result);
      setIsEditing(false);
    } catch (error) {
      console.error('File upload error:', error);
      alert('文件上传解析失败，请重试');
    } finally {
      setUploading(false);
      // 清空 input，以便同一个文件可以再次触发 change
      event.target.value = '';
    }
  };

  const handleBatchFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newBatchFiles: BatchFile[] = files.map(file => ({
      file,
      status: 'pending'
    }));

    setBatchFiles(prev => [...prev, ...newBatchFiles]);
    setIsBatchMode(true);
    setCandidate(null);
    if (e.target) e.target.value = '';
  };

  const removeBatchFile = (index: number) => {
    setBatchFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearBatchFiles = () => {
    setBatchFiles([]);
    setIsBatchMode(false);
  };

  const startBatchParse = async () => {
    const pendingFiles = batchFiles.filter(f => f.status === 'pending' || f.status === 'failed');
    if (pendingFiles.length === 0) {
      console.log("没有待解析的文件");
      return;
    }

    setParsing(true);
    console.log(`开始批量解析，共 ${pendingFiles.length} 个文件`);
    
    // 依次解析文件
    for (let i = 0; i < batchFiles.length; i++) {
      const currentFile = batchFiles[i];
      if (currentFile.status !== 'pending' && currentFile.status !== 'failed') continue;

      console.log(`正在上传解析第 ${i + 1} 个文件: ${currentFile.file.name}`);
    console.log(`请求地址: ${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/resume/upload`);

    setBatchFiles(prev => {
      const next = [...prev];
      next[i] = { ...next[i], status: 'parsing' };
      return next;
    });

    try {
      const result = await geminiService.uploadResume(currentFile.file);
      console.log(`文件 ${currentFile.file.name} 解析成功:`, result);
      
      setBatchFiles(prev => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'success', result };
        return next;
      });
    } catch (error: any) {
      console.error(`文件 ${currentFile.file.name} 解析失败:`, error);
      console.error(`错误详情:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setBatchFiles(prev => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'failed', error: error.message || '解析失败' };
        return next;
      });
    }
    }
    setParsing(false);
    console.log("批量解析任务结束");
  };

  const handleBatchImport = async () => {
    const successfulFiles = batchFiles.filter(f => f.status === 'success' && f.result);
    if (successfulFiles.length === 0) {
      alert("没有解析成功的简历可供入库");
      return;
    }

    setImporting(true);
    let successCount = 0;
    let failCount = 0;

    for (const batchFile of successfulFiles) {
      try {
        const result = batchFile.result!;
        const saveData = {
          name: result.name || '未知',
          email: result.email || '',
          phone: result.phone || '',
          education: result.education_summary || result.education || '',
          experience: result.experience_list || [],
          projects: result.projects || [],
          skills: result.skill_tags || [],
          summary: result.summary || '',
          education_summary: result.education_summary || '',
          experience_list: result.experience_list || [],
          skill_tags: result.skill_tags || [],
          parsing_score: result.parsing_score || 0,
          position: result.position || '研发',
          years_of_experience: result.years_of_experience || 0
        };

        await axios.post('http://localhost:8000/api/v1/candidates/', saveData);
        successCount++;
      } catch (error: any) {
        console.error("入库失败:", error);
        failCount++;
      }
    }

    setImporting(false);
    alert(`入库完成！成功: ${successCount} 份, 失败: ${failCount} 份`);
    
    // 清理已成功的
    setBatchFiles(prev => prev.filter(f => f.status !== 'success'));
    if (batchFiles.filter(f => f.status !== 'success').length === 0) {
      setIsBatchMode(false);
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
    if (editingIndex !== null) {
      // 批量模式下的编辑
      setBatchFiles(prev => {
        const next = [...prev];
        const currentItem = next[editingIndex];
        if (currentItem && currentItem.result) {
          next[editingIndex] = {
            ...currentItem,
            result: {
              ...currentItem.result,
              [field]: value
            }
          };
        }
        return next;
      });
      // 同时同步到当前显示的 candidate 以便预览
      setCandidate(prev => prev ? { ...prev, [field]: value } : { [field]: value } as Partial<Candidate>);
    } else {
      // 普通模式下的编辑
      setCandidate(prev => prev ? { ...prev, [field]: value } : { [field]: value } as Partial<Candidate>);
    }
  };

  const handleEditBatchItem = (index: number) => {
    const item = batchFiles[index];
    if (item.status === 'success' && item.result) {
      setEditingIndex(index);
      setCandidate(item.result);
      setIsEditing(true);
      // 滚动到编辑区域
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  };

  const finishEditing = () => {
    setEditingIndex(null);
    setIsEditing(false);
    setCandidate(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-black text-slate-800 mb-4 flex items-center">
          <i className="fas fa-magic text-indigo-600 mr-3"></i>
          AI 智能简历解析
        </h2>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          将简历原始内容（PDF、Word 或纯文本）上传或粘贴至下方。RecruitAI 将利用 AI 模型精准提取关键实体信息。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="在此粘贴简历文本内容..."
              className="w-full h-64 p-5 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-mono bg-slate-50/50 placeholder:text-slate-300"
            />
          </div>
          
          <div className="flex flex-col space-y-4">
            <div className="flex-1 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/30 flex flex-col items-center justify-center p-6 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group relative">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.txt"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                disabled={uploading || parsing}
              />
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                {uploading ? (
                  <i className="fas fa-spinner fa-spin text-xl text-indigo-600"></i>
                ) : (
                  <i className="fas fa-file-arrow-up text-xl text-slate-400 group-hover:text-indigo-600"></i>
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-700 mb-1">
                单份解析
              </h4>
            </div>

            <div className="flex-1 border-2 border-dashed border-indigo-200 rounded-2xl bg-indigo-50/10 flex flex-col items-center justify-center p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group relative">
              <input
                type="file"
                multiple
                onChange={handleBatchFileSelect}
                accept=".pdf,.doc,.docx,.txt"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                disabled={uploading || parsing}
              />
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <i className="fas fa-copy text-xl text-indigo-500 group-hover:text-indigo-600"></i>
              </div>
              <h4 className="text-xs font-bold text-indigo-700 mb-1">
                批量解析
              </h4>
            </div>
          </div>
        </div>

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

      {/* 批量解析列表 */}
      {isBatchMode && batchFiles.length > 0 && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl animate-in fade-in slide-in-from-top-4 duration-500 mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-black text-slate-800">批量解析队列</h3>
              <p className="text-xs text-slate-500 mt-1">已选择 {batchFiles.length} 份简历，待解析</p>
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={clearBatchFiles}
                className="px-4 py-2 text-slate-400 hover:text-rose-500 font-bold text-xs transition-colors"
              >
                清空列表
              </button>
              <button 
                onClick={startBatchParse}
                disabled={parsing || batchFiles.filter(f => f.status === 'pending' || f.status === 'failed').length === 0}
                className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100 flex items-center"
              >
                {parsing ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-play mr-2"></i>}
                开始批量解析
              </button>
              <button 
                onClick={handleBatchImport}
                disabled={importing || parsing || batchFiles.filter(f => f.status === 'success').length === 0}
                className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-100 flex items-center"
              >
                {importing ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-cloud-arrow-up mr-2"></i>}
                一键入库 ({batchFiles.filter(f => f.status === 'success').length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {batchFiles.map((item, index) => (
              <div key={index} className={`p-4 rounded-xl border transition-all ${
                item.status === 'success' ? 'bg-emerald-50/50 border-emerald-100' : 
                item.status === 'failed' ? 'bg-rose-50/50 border-rose-100' :
                item.status === 'parsing' ? 'bg-indigo-50/50 border-indigo-100 animate-pulse' :
                'bg-slate-50/50 border-slate-100'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      item.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 
                      item.status === 'failed' ? 'bg-rose-100 text-rose-600' :
                      'bg-white text-slate-400'
                    }`}>
                      <i className={`fas ${
                        item.file.name.endsWith('.pdf') ? 'fa-file-pdf' : 
                        item.file.name.endsWith('.txt') ? 'fa-file-lines' : 'fa-file-word'
                      }`}></i>
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-slate-700 truncate" title={item.file.name}>{item.file.name}</p>
                      <p className="text-[10px] text-slate-400">{(item.file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  {item.status === 'pending' && (
                    <button 
                      onClick={() => removeBatchFile(index)}
                      className="text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <i className="fas fa-times-circle text-sm"></i>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      item.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 
                      item.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                      item.status === 'parsing' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-slate-200 text-slate-600'
                    }`}>
                      {item.status === 'pending' ? '等待中' : 
                       item.status === 'parsing' ? '解析中...' : 
                       item.status === 'success' ? '解析成功' : '解析失败'}
                    </span>
                    {item.status === 'success' && (
                      <button 
                        onClick={() => handleEditBatchItem(index)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${
                          editingIndex === index 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50'
                        }`}
                      >
                        <i className={`fas ${editingIndex === index ? 'fa-pen-nib' : 'fa-edit'} mr-1`}></i>
                        {editingIndex === index ? '正在编辑' : '核对并修正'}
                      </button>
                    )}
                  </div>
                  {item.status === 'success' && item.result && (
                    <span className="text-[10px] font-bold text-emerald-600">
                      匹配度 {item.result.parsing_score || 0}%
                    </span>
                  )}
                  {item.status === 'failed' && (
                    <span className="text-[10px] font-bold text-rose-500">{item.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    className="text-3xl font-black text-slate-800 border-b-4 border-indigo-500 bg-indigo-50/50 px-2 py-1 focus:outline-none w-full rounded-t-lg"
                    placeholder="请输入姓名..."
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
                        className="border-b-2 border-indigo-300 focus:border-indigo-500 focus:outline-none bg-indigo-50/30 px-2 py-0.5 rounded"
                        placeholder="邮箱地址"
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
                        className="border-b-2 border-indigo-300 focus:border-indigo-500 focus:outline-none bg-indigo-50/30 px-2 py-0.5 rounded"
                        placeholder="电话号码"
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
                <div className={`p-4 rounded-xl border-2 transition-all ${isEditing ? 'bg-white border-indigo-500 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                  {isEditing ? (
                    <textarea
                      value={candidate.education_summary || ''}
                      onChange={(e) => updateCandidate('education_summary', e.target.value)}
                      className="w-full bg-transparent border-none focus:outline-none text-slate-800 font-bold leading-relaxed resize-none"
                      rows={3}
                      placeholder="教育经历描述..."
                    />
                  ) : (
                    <p className="text-slate-800 font-bold leading-relaxed">{candidate.education_summary || '未提取到教育信息'}</p>
                  )}
                </div>
              </section>

              <section>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">工作经历</h4>
                <div className={`space-y-4 rounded-xl transition-all ${isEditing ? 'p-4 bg-white border-2 border-indigo-500 shadow-sm' : ''}`}>
                  {isEditing ? (
                    <textarea
                      value={candidate.experience_list?.join('\n') || ''}
                      onChange={(e) => updateCandidate('experience_list', e.target.value.split('\n').filter(line => line.trim() !== ''))}
                      className="w-full bg-transparent border-none focus:outline-none text-slate-600 text-sm leading-relaxed font-medium"
                      rows={8}
                      placeholder="每行一段工作经历描述..."
                    />
                  ) : (
                    <ul className="space-y-4">
                      {candidate.experience_list?.map((exp, i) => (
                        <li key={i} className="flex items-start group">
                          <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 mr-4 flex-shrink-0 group-hover:scale-125 transition-transform"></div>
                          <div className="text-slate-600 text-sm leading-relaxed font-medium markdown-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {exp}
                            </ReactMarkdown>
                          </div>
                        </li>
                      ))}
                      {(!candidate.experience_list || candidate.experience_list.length === 0) && (
                        <li className="text-slate-400 text-sm italic">未提取到经历信息</li>
                      )}
                    </ul>
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-8">
              <section>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">项目经验</h4>
                <div className="space-y-4">
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={projectsJson}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProjectsJson(val);
                          try {
                            const parsed = JSON.parse(val);
                            updateCandidate('projects', parsed);
                          } catch (err) {
                            // 仅在 JSON 格式正确时同步到 candidate 状态
                          }
                        }}
                        className="w-full p-4 bg-white rounded-xl border-2 border-indigo-500 shadow-sm text-slate-600 text-xs font-mono leading-relaxed focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                        rows={10}
                        placeholder="请输入 JSON 格式的项目列表，例如：[
  {
    'name': '项目名称',
    'description': '项目描述'
  }
]"
                      />
                      <p className="text-[10px] text-slate-400 italic">提示：请确保 JSON 格式正确（双引号、闭合括号等）</p>
                    </div>
                  ) : (
                    candidate.projects && candidate.projects.length > 0 ? (
                      candidate.projects.map((proj: any, i: number) => (
                        <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-slate-800 font-bold text-sm">{proj.name || (typeof proj === 'string' ? proj : '项目 ' + (i+1))}</p>
                          {proj.description && (
                            <div className="text-slate-500 text-xs mt-2 leading-relaxed markdown-content">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {Array.isArray(proj.description) ? proj.description[0] : proj.description}
                              </ReactMarkdown>
                            </div>
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
                  <div className="p-4 bg-white rounded-xl border-2 border-indigo-500 shadow-sm">
                    <input
                      type="text"
                      value={candidate.skill_tags?.join('，') || ''}
                      onChange={(e) => updateCandidate('skill_tags', e.target.value.split(/[，,]/).filter(s => s.trim() !== ''))}
                      className="w-full bg-transparent border-none focus:outline-none text-indigo-700 text-xs font-bold"
                      placeholder="技能标签，用中文或英文逗号分隔"
                    />
                    <p className="text-[10px] text-slate-400 mt-2 italic">示例：Java, Python, 项目管理</p>
                  </div>
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
                      className="w-full text-slate-600 text-sm font-medium leading-relaxed bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-sm italic focus:outline-none"
                      rows={6}
                      placeholder="简历核心价值画像总结..."
                    />
                  ) : (
                    <div className="text-slate-600 text-sm font-medium leading-relaxed bg-indigo-50/30 p-6 rounded-2xl border border-indigo-100/30 italic markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {candidate.summary || 'AI 正在分析该候选人的核心价值主张...'}
                      </ReactMarkdown>
                    </div>
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
              {editingIndex !== null ? (
                <button 
                  onClick={finishEditing}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center"
                >
                  <i className="fas fa-check mr-2"></i>
                  确认修改并返回列表
                </button>
              ) : (
                <button 
                  onClick={handleSave}
                  className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                >
                  入库人才库
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeAnalyzer;
