import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { geminiService } from '../services/geminiService';

interface KnowledgeItem {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  updatedAt: string;
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  sourceIds?: string[];
}

const KnowledgeBase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'chat'>('search');
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [aiTip, setAiTip] = useState<string>('');
  const [loadingTip, setLoadingTip] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKnowledge, setNewKnowledge] = useState({
    title: '',
    category: '面试要求',
    content: '',
    tags: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // AI 问答相关状态
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const categories = ['全部', '面试要求', '考察事项', '通用标准', '技术文档', '公司制度'];

  useEffect(() => {
    fetchKnowledge();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  useEffect(() => {
    if (selectedItem) {
      fetchAiTip(selectedItem);
    }
  }, [selectedItem]);

  const fetchKnowledge = async () => {
    setLoading(true);
    try {
      const data = await geminiService.getKnowledgeBase();
      setKnowledgeList(data);
    } catch (error) {
      console.error("获取知识库失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiTip = async (item: KnowledgeItem) => {
    setLoadingTip(true);
    setAiTip(''); // 清空旧提示
    try {
      const tip = await geminiService.getKnowledgeTip(item.title, item.content);
      setAiTip(tip);
    } catch (error) {
      console.error("获取 AI 提示失败:", error);
      setAiTip("针对该岗位的考察，建议结合候选人的项目经历进行深入提问。");
    } finally {
      setLoadingTip(false);
    }
  };

  const handleSendQuestion = async () => {
    if (!inputQuestion.trim() || isAsking) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: inputQuestion,
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, userMsg]);
    setInputQuestion('');
    setIsAsking(true);

    try {
      const result = await geminiService.chatWithKnowledge(inputQuestion);
      const aiMsg: ChatMessage = {
        role: 'ai',
        content: result.answer,
        timestamp: new Date(),
        sourceIds: result.source_ids
      };
      setChatHistory(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("问答请求失败:", error);
    } finally {
      setIsAsking(false);
    }
  };

  const handleAddKnowledge = async () => {
    if (!newKnowledge.title || !newKnowledge.content) {
      alert('请填写标题和内容');
      return;
    }
    setIsSubmitting(true);
    try {
      await geminiService.addKnowledge({
        ...newKnowledge,
        tags: newKnowledge.tags.split(/\s+/).filter(tag => tag !== '')
      });
      setShowAddModal(false);
      setNewKnowledge({ title: '', category: '面试要求', content: '', tags: '' });
      fetchKnowledge();
      alert('录入成功');
    } catch (error) {
      console.error('录入失败:', error);
      alert('录入失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredKnowledge = knowledgeList.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    let matchesCategory = false;
    if (selectedCategory === '全部') {
      matchesCategory = true;
    } else if (selectedCategory === 'Java') {
      matchesCategory = item.tags.includes('Java');
    } else if (selectedCategory === 'Python') {
      matchesCategory = item.tags.includes('Python');
    } else if (selectedCategory === '前端') {
      matchesCategory = item.tags.includes('前端');
    } else {
      matchesCategory = item.category === selectedCategory;
    }
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 h-[calc(100vh-160px)] flex flex-col">
      <header className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-2xl font-black text-slate-800">招聘知识库</h1>
          <p className="text-sm text-slate-500 mt-1">查看面试要求、考察事项及招聘标准</p>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <i className="fas fa-plus"></i>
            <span>录入知识</span>
          </button>
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button 
              onClick={() => setActiveTab('search')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'search' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="fas fa-search"></i>
              <span>检索模式</span>
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'chat' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="fas fa-robot"></i>
              <span>AI 问答模式</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* 左侧：知识列表（仅在检索模式显示更多细节，问答模式可作为参考） */}
        <div className="w-1/3 flex flex-col space-y-4">
          <div className="relative">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input 
              type="text"
              placeholder="搜索知识点..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedCategory === cat 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {loading ? (
              <div className="flex justify-center py-10">
                <i className="fas fa-spinner fa-spin text-indigo-500 text-2xl"></i>
              </div>
            ) : filteredKnowledge.map(item => (
              <div 
                key={item.id}
                onClick={() => {
                  setSelectedItem(item);
                  setActiveTab('search'); // 点击列表项自动切换到检索模式看详情
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedItem?.id === item.id 
                    ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md">
                    {item.category}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">{item.updatedAt}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-800 mb-2">{item.title}</h3>
                <div className="flex flex-wrap gap-1">
                  {item.tags.map((tag: string) => (
                    <span key={tag} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">#{tag}</span>
                  ))}
                </div>
              </div>
            ))}
            {!loading && filteredKnowledge.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <i className="fas fa-ghost text-3xl mb-3"></i>
                <p className="text-sm font-medium">未找到相关内容</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：详情展示 或 AI 问答 */}
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
          {activeTab === 'search' ? (
            // 检索模式详情
            selectedItem ? (
              <div className="h-full flex flex-col">
                <div className="p-8 border-b border-slate-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">{selectedItem.category}</span>
                      <h2 className="text-2xl font-black text-slate-800 mt-1">{selectedItem.title}</h2>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                        <i className="fas fa-calendar"></i>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">更新于 {selectedItem.updatedAt}</span>
                    </div>
                  </div>
                </div>
                <div className="p-8 flex-1 overflow-y-auto bg-slate-50/30">
                  <div className="prose prose-slate prose-indigo max-w-none markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedItem.content}
                    </ReactMarkdown>
                  </div>
                  
                  {/* AI 辅助建议区域 */}
                    <div className="mt-10 p-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl text-white shadow-xl shadow-indigo-200">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                          <i className="fas fa-sparkles text-white"></i>
                        </div>
                        <h4 className="font-bold">AI 面试官提示</h4>
                        {loadingTip && <i className="fas fa-spinner fa-spin text-white/50 text-xs"></i>}
                      </div>
                      <div className="text-sm text-indigo-50 leading-relaxed opacity-90 markdown-content">
                        {loadingTip ? '正在生成专业面试建议...' : (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {aiTip}
                          </ReactMarkdown>
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          setActiveTab('chat');
                          setInputQuestion(`关于"${selectedItem.title}"，我该如何进行更深入的考察？`);
                        }}
                        className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-all border border-white/30"
                      >
                        去 AI 问答进一步咨询
                      </button>
                    </div>
                  </div>
                </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-10">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <i className="fas fa-book-open text-4xl text-slate-200"></i>
                </div>
                <h3 className="text-lg font-bold text-slate-600">选择一个知识点查看详情</h3>
                <p className="text-sm mt-2 max-w-xs text-center leading-relaxed">
                  您可以从左侧列表中选择，或者切换到 AI 问答模式进行咨询
                </p>
              </div>
            )
          ) : (
            // AI 问答模式
            <div className="h-full flex flex-col bg-slate-50/30">
              <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <i className="fas fa-robot"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">知识库 AI 助手</h3>
                    <p className="text-[10px] text-green-500 font-bold flex items-center">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                      RAG 增强模式已开启
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setChatHistory([])}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                >
                  清空对话
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {chatHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                      <i className="fas fa-comments text-2xl text-slate-200"></i>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-600">有问题尽管问我</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                        我会优先从知识库中为您寻找答案，帮助您更好地理解招聘标准。
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 w-full max-w-xs mt-4">
                      {[
                        "资深后端开发主要考察什么？",
                        "前端架构师的能力矩阵有哪些？",
                        "如何运用 STAR 原则进行评价？"
                      ].map(q => (
                        <button 
                          key={q}
                          onClick={() => setInputQuestion(q)}
                          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-all text-left font-medium"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                          : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                      }`}>
                        <div className={`markdown-content text-sm leading-relaxed ${msg.role === 'user' ? 'text-white' : 'text-slate-700'}`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                        
                        {msg.role === 'ai' && msg.sourceIds && msg.sourceIds.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 mb-2 flex items-center">
                              <i className="fas fa-link mr-1"></i> 引用来源：
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {Array.from(new Set(msg.sourceIds)).slice(0, 1).map(id => {
                                const doc = knowledgeList.find(k => k.id === id);
                                return doc ? (
                                  <button
                                    key={id}
                                    onClick={() => {
                                      setSelectedItem(doc);
                                      setActiveTab('search');
                                    }}
                                    className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-[10px] font-bold text-slate-500 transition-all border border-slate-200 hover:border-indigo-200"
                                  >
                                    {doc.title}
                                  </button>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}

                        <div className={`text-[10px] mt-2 opacity-50 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {isAsking && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm">
                      <div className="flex space-x-1.5">
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 bg-white border-t border-slate-100">
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                  <input 
                    type="text"
                    value={inputQuestion}
                    onChange={(e) => setInputQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendQuestion()}
                    placeholder="输入您想咨询的招聘问题..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2"
                  />
                  <button 
                    onClick={handleSendQuestion}
                    disabled={!inputQuestion.trim() || isAsking}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                      inputQuestion.trim() && !isAsking 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    <i className="fas fa-paper-plane text-xs"></i>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 text-center">
                  由 RecruitAI 强力驱动 · 优先参考企业知识库
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 录入知识模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">录入新知识</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">知识标题</label>
                <input 
                  type="text"
                  value={newKnowledge.title}
                  onChange={(e) => setNewKnowledge({...newKnowledge, title: e.target.value})}
                  placeholder="例如：高级前端开发面试要点"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">分类</label>
                  <select 
                    value={newKnowledge.category}
                    onChange={(e) => setNewKnowledge({...newKnowledge, category: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
                  >
                    {categories.filter(c => c !== '全部').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">标签 (空格分隔)</label>
                  <input 
                    type="text"
                    value={newKnowledge.tags}
                    onChange={(e) => setNewKnowledge({...newKnowledge, tags: e.target.value})}
                    placeholder="例如：React 架构 性能优化"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">知识内容 (支持 Markdown)</label>
                <textarea 
                  rows={10}
                  value={newKnowledge.content}
                  onChange={(e) => setNewKnowledge({...newKnowledge, content: e.target.value})}
                  placeholder="输入详细的知识库内容..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium resize-none"
                ></textarea>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end space-x-3">
              <button 
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-all"
              >
                取消
              </button>
              <button 
                onClick={handleAddKnowledge}
                disabled={isSubmitting}
                className={`px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-100 flex items-center space-x-2 ${
                  isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'
                }`}
              >
                {isSubmitting && <i className="fas fa-spinner fa-spin"></i>}
                <span>提交录入</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
