import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { geminiService } from '../services/geminiService';
import { ChatMessage } from '../types';

interface AIAssistantProps {
  mode?: 'floating' | 'embedded';
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onAction?: (action: string, params: any) => void;
}

// 将子组件移到外部，避免在主组件渲染时重新创建组件定义，解决输入框焦点丢失问题
const Header: React.FC<{ 
  mode: string; 
  setIsOpen: (open: boolean) => void;
  onClear: () => void;
}> = ({ mode, setIsOpen, onClear }) => (
  <div className="bg-slate-900 p-5 text-white flex items-center justify-between flex-shrink-0">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
        <i className="fa-solid fa-robot text-lg"></i>
      </div>
      <div>
        <h3 className="font-black text-sm tracking-tight">智能招聘 Agent</h3>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Online</p>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <button 
        onClick={() => {
          if (window.confirm('确定要开始新对话吗？当前聊天记录将被清空。')) {
            onClear();
          }
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all text-[10px] font-bold border border-slate-700 active:scale-95"
        title="新建对话"
      >
        <i className="fa-solid fa-plus"></i>
        <span>新建对话</span>
      </button>
      {mode === 'floating' && (
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      )}
    </div>
  </div>
);

interface CandidateCardProps {
  id: string;
  name: string;
  position: string;
  score?: number;
  analysis?: string;
  matching_points?: string[];
  mismatched_points?: string[];
  jobId?: number;
  onAction?: (action: string, params: any) => void;
}

const CandidateCard: React.FC<CandidateCardProps> = ({ 
  id, name, position, score, analysis, matching_points, mismatched_points, jobId, onAction 
}) => {
  return (
    <div className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300 relative flex flex-col my-4">
      <div className="flex items-start justify-between mb-4">
        <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 text-xl font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
          {name.charAt(0)}
        </div>
        <div className="text-right">
          {score !== undefined ? (
            <>
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">匹配度</span>
              <span className="text-xl font-black text-indigo-600 leading-none">{score}</span>
            </>
          ) : (
            <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-1 rounded-lg text-[10px] font-bold">
              入库成功
            </span>
          )}
        </div>
      </div>

      <h3 className="text-lg font-bold text-slate-800 mb-1">{name}</h3>
      <p className="text-xs font-semibold text-slate-500 mb-3">{position || '未指定职位'}</p>

      {analysis && (
        <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{analysis}</p>
        </div>
      )}

      <div className="pt-4 border-t border-slate-50 flex items-center gap-2">
        <button 
          onClick={() => onAction?.('candidate', { id, score, analysis, matching_points, mismatched_points })}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95"
        >
          <i className="fa-solid fa-circle-info"></i>
          查看详情
        </button>
      </div>
    </div>
  );
};

interface JobCardProps {
  id: number;
  title: string;
  category: string;
  requirement_count: number;
  description?: string;
  onAction?: (action: string, params: any) => void;
}

const JobCard: React.FC<JobCardProps> = ({ id, title, category, requirement_count, description, onAction }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all my-4 group border-l-4 border-l-indigo-500">
    <div className="flex justify-between items-start mb-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-wider rounded-md">
            {category}
          </span>
          <span className="text-[10px] text-slate-400 font-bold">
            需求: {requirement_count}人
          </span>
        </div>
        <h4 className="font-black text-slate-800 tracking-tight text-base group-hover:text-indigo-600 transition-colors">{title}</h4>
      </div>
      <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
        <i className="fa-solid fa-briefcase"></i>
      </div>
    </div>
    
    {description && (
      <div className="mb-4">
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed italic">
          {description.replace(/[#*`]/g, '').slice(0, 100)}...
        </p>
      </div>
    )}

    <button 
      onClick={() => onAction?.('jd', { id })}
      className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95"
    >
      <i className="fa-solid fa-circle-info"></i>
      职位详情
    </button>
  </div>
);

const ChatArea: React.FC<{ 
  chatHistory: ChatMessage[]; 
  isLoading: boolean; 
  chatEndRef: React.RefObject<HTMLDivElement>;
  onAction?: (action: string, params: any) => void;
}> = ({ chatHistory, isLoading, chatEndRef, onAction }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleLinkClick = (e: React.MouseEvent, href: string) => {
    console.log('ChatArea: handleLinkClick raw href:', href);
    e.preventDefault();
    e.stopPropagation();
    
    // 处理可能的 URL 补全（例如在某些环境下 action: 会被自动加上当前域名）
    let cleanHref = href.trim();
    
    // 如果包含 action: 但不是以它开头，尝试提取它
    if (!cleanHref.toLowerCase().startsWith('action:') && cleanHref.toLowerCase().includes('action:')) {
      const index = cleanHref.toLowerCase().indexOf('action:');
      cleanHref = cleanHref.substring(index);
      console.log('ChatArea: Extracted action from URL:', cleanHref);
    }

    if (cleanHref.toLowerCase().startsWith('action:')) {
      const parts = cleanHref.split(':');
      const action = parts[1];
      const params: any = {};
      
      if (action === 'jd') params.id = parseInt(parts[2]);
      if (action === 'candidate') params.id = parts[2];
      if (action === 'assign') {
        params.candidateId = parts[2];
        params.jobId = parseInt(parts[3]);
      }
      
      console.log('ChatArea: Dispatching onAction:', action, params);
      onAction?.(action, params);
    } else if (cleanHref.startsWith('http')) {
      console.log('ChatArea: Opening external link:', cleanHref);
      window.open(cleanHref, '_blank', 'noopener,noreferrer');
    } else {
      console.warn('ChatArea: Unrecognized link format:', cleanHref);
    }
  };

  return (
    <div 
      className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50"
      style={{ scrollbarGutter: 'stable' }}
    >
      {chatHistory.length === 0 && (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <i className="fa-solid fa-comment-dots text-3xl text-blue-500"></i>
          </div>
          <h4 className="font-black text-slate-800 mb-3 tracking-tight">我是您的招聘 Agent</h4>
          <p className="text-slate-500 text-xs px-8 leading-relaxed font-medium">
            我可以帮您搜索人才、分析简历匹配度、生成面试题或提供招聘建议。
          </p>
        </div>
      )}
      {chatHistory.map((msg, index) => (
        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 rounded-tr-none'
                : 'bg-white text-slate-800 shadow-sm border border-slate-200 rounded-tl-none'
            }`}
          >
            <div className="markdown-container">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node, href, children, ...props }) => {
                    const targetHref = href || '';
                    const isAction = targetHref.trim().toLowerCase().includes('action:');
                    
                    if (isAction) {
                      const actionType = targetHref.includes('candidate') ? 'candidate' : 
                                       targetHref.includes('jd') ? 'jd' : 
                                       targetHref.includes('assign') ? 'assign' : '';
                      
                      const isCandidate = actionType === 'candidate';
                      const isJd = actionType === 'jd';
                      const isAssign = actionType === 'assign';
                      
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleLinkClick(e as any, targetHref);
                          }}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all border border-blue-200 my-1 mx-0.5 active:scale-95 shadow-sm"
                        >
                          <i className={`fa-solid ${isCandidate ? 'fa-user-tie' : isJd ? 'fa-briefcase' : isAssign ? 'fa-user-plus' : 'fa-arrow-up-right-from-square'} text-[10px]`}></i>
                          {children}
                        </button>
                      );
                    }
                    
                    const isExternal = targetHref.startsWith('http');
                    return (
                      <a 
                        href={targetHref}
                        onClick={(e) => handleLinkClick(e as any, targetHref)}
                        target={isExternal ? "_blank" : "_self"}
                        rel={isExternal ? "noopener noreferrer" : ""}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {children}
                        {isExternal && <i className="fa-solid fa-external-link ml-1 text-[10px]"></i>}
                      </a>
                    );
                  },
                  p: ({ children }) => {
                    // 尝试在段落中寻找卡片 JSON
                    const content = React.Children.toArray(children).join('');
                    if (content.trim().startsWith('{') && content.includes('"type": "candidate"')) {
                      try {
                        const cleanContent = content.trim().replace(/,\s*([}\]])/g, '$1');
                        const data = JSON.parse(cleanContent);
                        return <CandidateCard {...data.props} onAction={onAction} />;
                      } catch (e) {
                        // 解析失败则按普通文本渲染
                      }
                    }
                    if (content.trim().startsWith('{') && content.includes('"type": "job"')) {
                      try {
                        const cleanContent = content.trim().replace(/,\s*([}\]])/g, '$1');
                        const data = JSON.parse(cleanContent);
                        return <JobCard {...data.props} onAction={onAction} />;
                      } catch (e) {
                        // 解析失败则按普通文本渲染
                      }
                    }
                    return <p className="mb-4 last:mb-0">{children}</p>;
                  },
                  code: ({ node, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const content = String(children).replace(/\n$/, '');
                    
                    if (match && match[1] === 'card') {
                      console.log('Markdown: Found card block:', content);
                      try {
                        // 预处理内容，防止 agent 输出一些非标准的 JSON（如带有注释或末尾逗号）
                        const cleanContent = content.trim().replace(/,\s*([}\]])/g, '$1');
                        const data = JSON.parse(cleanContent);
                        console.log('Markdown: Parsed card data:', data);
                        
                        if (data.type === 'candidate') {
                          return (
                            <CandidateCard 
                              {...data.props} 
                              onAction={onAction} 
                            />
                          );
                        }
                        if (data.type === 'job') {
                          return (
                            <JobCard 
                              {...data.props} 
                              onAction={onAction} 
                            />
                          );
                        }
                      } catch (e) {
                        console.error('Card JSON parse error:', e, content);
                        return (
                          <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-rose-600 text-[10px] font-mono whitespace-pre-wrap">
                            <p className="font-black mb-1">卡片解析失败:</p>
                            {content}
                          </div>
                        );
                      }
                    }
                    return <code className={className} {...props}>{children}</code>;
                  }
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
            <div className={`text-[10px] mt-2 font-medium flex items-center justify-between ${msg.role === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => handleCopy(msg.content, index)}
                  className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  title="复制回答"
                >
                  <i className={`fa-solid ${copiedIndex === index ? 'fa-check text-emerald-500' : 'fa-copy'}`}></i>
                  <span>{copiedIndex === index ? '已复制' : '复制'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 rounded-tl-none flex gap-1.5">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
  );
};

const InputArea: React.FC<{ 
  inputMessage: string; 
  setInputMessage: (val: string) => void; 
  handleSendMessage: () => void; 
  handleFileUpload: (file: File) => void;
  pendingFile: { name: string; content: string } | null;
  onRemoveFile: () => void;
  isLoading: boolean 
}> = ({ inputMessage, setInputMessage, handleSendMessage, handleFileUpload, pendingFile, onRemoveFile, isLoading }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
      // 清空 input 以便下次选择同一文件
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-5 bg-white border-t border-slate-100 flex-shrink-0">
      {pendingFile && (
        <div className="mb-3 flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <i className="fa-solid fa-file-lines text-blue-500 text-xs"></i>
          <span className="text-xs font-bold text-blue-700 truncate max-w-[200px]">{pendingFile.name}</span>
          <button 
            onClick={onRemoveFile}
            className="ml-auto w-5 h-5 flex items-center justify-center rounded-full hover:bg-blue-200 text-blue-400 hover:text-blue-600 transition-colors"
          >
            <i className="fa-solid fa-xmark text-[10px]"></i>
          </button>
        </div>
      )}
      <div className="flex gap-3 items-end bg-slate-100 p-2 rounded-2xl focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={onFileChange} 
          className="hidden" 
          accept=".pdf,.doc,.docx,.txt"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || !!pendingFile}
          className="w-10 h-10 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl flex-shrink-0 flex items-center justify-center transition-all active:scale-95 mb-0.5 disabled:opacity-30"
          title={pendingFile ? "已选择文件" : "上传文件 (简历/JD)"}
        >
          <i className="fa-solid fa-paperclip text-lg"></i>
        </button>
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={pendingFile ? "请输入针对该文件的操作指令..." : "输入指令或上传文件..."}
          className="flex-1 px-2 py-2 bg-transparent border-none text-sm focus:ring-0 outline-none font-medium text-slate-700 placeholder:text-slate-400 resize-none overflow-y-auto"
          style={{ maxHeight: '200px' }}
        />
        <button
          onClick={handleSendMessage}
          disabled={isLoading || !inputMessage.trim()}
          className="w-10 h-10 bg-blue-600 text-white rounded-xl flex-shrink-0 flex items-center justify-center hover:bg-blue-700 transition-all disabled:opacity-50 disabled:grayscale shadow-lg shadow-blue-600/30 active:scale-95 mb-0.5"
        >
          <i className="fa-solid fa-paper-plane text-xs"></i>
        </button>
      </div>
    </div>
  );
};

const AIAssistant: React.FC<AIAssistantProps> = ({ 
  mode = 'floating', 
  chatHistory, 
  setChatHistory,
  onAction
}) => {
  const [isOpen, setIsOpen] = useState(mode === 'embedded');
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; content: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    let finalMessage = inputMessage;
    let displayMessage = inputMessage;

    // 如果有待处理文件，将其内容合并到消息中
    if (pendingFile) {
      finalMessage = `我上传了一个文件 "${pendingFile.name}"，内容如下，请帮我处理（如果是简历请入库，如果是 JD 请创建）：\n\n${pendingFile.content}\n\n用户指令：${inputMessage}`;
      displayMessage = `[上传文件: ${pendingFile.name}]\n${inputMessage}`;
    }

    const userMsg: ChatMessage = {
      role: 'user',
      content: displayMessage,
      timestamp: new Date().toISOString()
    };

    setChatHistory(prev => [...prev, userMsg]);
    setInputMessage('');
    setPendingFile(null); // 发送后清除暂存文件
    setIsLoading(true);

    try {
      const history = chatHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await geminiService.chatWithAgent(finalMessage, history);
      
      const aiMsg: ChatMessage = {
        role: 'assistant',
        content: response.answer,
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, aiMsg]);
    } catch (error) { 
      console.error("Agent 对话失败:", error);
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: "抱歉，我现在遇到了一些技术困难，请稍后再试。",
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const response = await geminiService.uploadFileToAgent(file);
      setPendingFile({
        name: file.name,
        content: response.content
      });
    } catch (error) {
      console.error("文件上传失败:", error);
      alert("文件解析失败，请确保文件格式正确且内容可读。");
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === 'embedded') {
    return (
      <div className="w-full h-full bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/50">
        <Header mode={mode} setIsOpen={setIsOpen} onClear={() => setChatHistory([])} />
        <ChatArea chatHistory={chatHistory} isLoading={isLoading} chatEndRef={chatEndRef} onAction={onAction} />
        <InputArea 
          inputMessage={inputMessage} 
          setInputMessage={setInputMessage} 
          handleSendMessage={handleSendMessage} 
          handleFileUpload={handleFileUpload}
          pendingFile={pendingFile}
          onRemoveFile={() => setPendingFile(null)}
          isLoading={isLoading} 
        />
      </div>
    );
  }

  return (
    <div className="fixed bottom-8 right-8 z-50">
      {/* 悬浮按钮 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 bg-slate-900 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-blue-500/20 active:scale-95 group"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <i className="fa-solid fa-robot text-white text-lg group-hover:animate-bounce"></i>
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
        </button>
      )}

      {/* 聊天窗口 */}
      {isOpen && (
        <div className="absolute bottom-0 right-0 w-[420px] h-[600px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden border border-slate-200/50 animate-in fade-in slide-in-from-bottom-8 duration-300">
          <Header mode={mode} setIsOpen={setIsOpen} onClear={() => setChatHistory([])} />
          <ChatArea chatHistory={chatHistory} isLoading={isLoading} chatEndRef={chatEndRef} onAction={onAction} />
          <InputArea 
            inputMessage={inputMessage} 
            setInputMessage={setInputMessage} 
            handleSendMessage={handleSendMessage} 
            handleFileUpload={handleFileUpload}
            pendingFile={pendingFile}
            onRemoveFile={() => setPendingFile(null)}
            isLoading={isLoading} 
          />
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
