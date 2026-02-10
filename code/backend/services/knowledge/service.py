from typing import List, Optional, Dict
import logging
from core.config import settings
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.documents import Document
from sqlalchemy.orm import Session
from models.knowledge import Knowledge
from schemas.knowledge import KnowledgeItem, KnowledgeAnswer, KnowledgeItemCreate
from crud.knowledge import get_knowledge_all, create_knowledge
import datetime

from .retriever import create_hybrid_retriever, ArkEmbeddings
from .intent import SimpleIntentRecognizer, QueryCategory
from .rewriter import SimpleQueryRewriter

logger = logging.getLogger(__name__)

# 会话历史存储
chat_store: Dict[str, List[Dict]] = {}

class KnowledgeService:
    def __init__(self):
        print("🚀 Initializing KnowledgeService with RAG (LLM: Doubao/Ark)...")
        # 初始化 LLM (使用 Doubao/Ark)
        self.llm = ChatOpenAI(
            model=settings.LLM_MODEL,
            api_key=settings.ARK_API_KEY,
            base_url=settings.ARK_BASE_URL,
            temperature=0.1,
            top_p=0.9,
            max_tokens=1024
        )
        
        # 初始化 Embedding (使用自定义 ArkEmbeddings)
        self.embeddings = ArkEmbeddings(
            model=settings.EMBEDDING_MODEL,
            api_key=settings.ARK_API_KEY,
            base_url=settings.ARK_BASE_URL
        )
        
        # 初始化组件
        self.intent_recognizer = SimpleIntentRecognizer(self.llm)
        self.query_rewriter = SimpleQueryRewriter(self.llm)
        
        # 缓存检索器
        self.retriever = None
        self.last_doc_count = 0

    def seed_data_if_empty(self, db: Session):
        count = db.query(Knowledge).count()
        if count == 0:
            logger.info("Knowledge base is empty, seeding default data...")
            default_data = [
                {
                    "title": "资深后端开发面试考察重点",
                    "category": "面试要求",
                    "content": "1. 分布式系统设计：CAP理论、Base理论、强一致性与最终一致性的权衡。\n2. 高并发处理：缓存穿透/击穿/雪崩解决方案、消息队列异步解耦。\n3. 数据库优化：索引原理、SQL优化、分库分表策略。\n4. 架构能力：微服务治理、Service Mesh、领域驱动设计(DDD)。",
                    "tags": ["后端", "资深", "系统设计"]
                },
                {
                    "title": "前端架构师核心能力矩阵",
                    "category": "考察事项",
                    "content": "1. 工程化能力：Webpack/Vite 构建优化、Monorepo 管理。\n2. 性能优化：首屏加载、渲染瓶颈分析、Core Web Vitals。\n3. 框架深度：React/Vue 渲染机制、状态管理设计模式。\n4. 跨端技术：React Native、Electron、小程序架构。",
                    "tags": ["前端", "架构师", "工程化"]
                },
                {
                    "title": "行为面试 (STAR原则) 评价标准",
                    "category": "通用标准",
                    "content": "S (Situation): 事情发生的背景。\nT (Task): 面对的任务和目标。\nA (Action): 针对任务采取的具体行动。\nR (Result): 最终达成的结果。\n评价重点：逻辑清晰度、真实性、候选人在其中的角色 and 贡献。",
                    "tags": ["行为面试", "软技能", "通用"]
                },
                {
                    "title": "Java JVM 调优与内存模型",
                    "category": "技术文档",
                    "content": "1. JMM (Java Memory Model)：主内存与工作内存、原子性、可见性、有序性。\n2. 垃圾回收算法：G1, ZGC, CMS 的原理与适用场景。\n3. JVM 参数调优：-Xms, -Xmx, -XX:MaxMetaspaceSize, -XX:+PrintGCDetails。\n4. 内存泄漏排查：使用 jmap, jstack, VisualVM 分析 Heap Dump。",
                    "tags": ["Java", "JVM", "调优"]
                }
            ]
            for item in default_data:
                create_knowledge(db, KnowledgeItemCreate(**item))
            logger.info(f"Seeded {len(default_data)} items.")

    def _get_retriever(self, db: Session):
        all_items = get_knowledge_all(db)
        if not self.retriever or len(all_items) != self.last_doc_count:
            documents = [
                Document(
                    page_content=f"标题: {item.title}\n内容: {item.content}",
                    metadata={"id": str(item.id), "title": item.title, "category": item.category}
                )
                for item in all_items
            ]
            if documents:
                self.retriever = create_hybrid_retriever(documents, self.embeddings)
                self.last_doc_count = len(all_items)
        return self.retriever

    async def get_all_knowledge(self, db: Session) -> List[KnowledgeItem]:
        self.seed_data_if_empty(db)
        items = get_knowledge_all(db)
        result = []
        for item in items:
            result.append(KnowledgeItem(
                id=str(item.id),
                title=item.title,
                category=item.category,
                content=item.content,
                tags=item.tags,
                updatedAt=item.updated_at.strftime("%Y-%m-%d")
            ))
        return result

    async def chat_with_knowledge(self, db: Session, question: str, session_id: str = "default") -> KnowledgeAnswer:
        self.seed_data_if_empty(db)
        
        # 1. 获取会话历史
        history = chat_store.get(session_id, [])
        
        # 2. 意图识别
        intent = self.intent_recognizer.categorize(question, history)
        logger.info(f"User intent: {intent}")
        
        # 3. 处理非 HR 问题
        if intent["category"] == "greeting":
            return KnowledgeAnswer(answer="你好！我是您的智能 HR 助手，有什么可以帮您的吗？", source_ids=[])
        elif intent["category"] == "small_talk":
            # 简单的闲聊处理
            response = self.llm.invoke(f"用户说: {question}\n请作为一个友好的 HR 助手给出简短回应。")
            return KnowledgeAnswer(answer=response.content, source_ids=[])
            
        # 4. 查询重写
        rewritten_query = self.query_rewriter.rewrite(question, history)
        logger.info(f"Rewritten query: {rewritten_query}")
        
        # 5. 检索知识
        retriever = self._get_retriever(db)
        final_docs = retriever.invoke(rewritten_query)
        source_ids = [doc.metadata["id"] for doc in final_docs]
            
        # 6. 生成回答
        context = "\n\n".join([doc.page_content for doc in final_docs])
        context_text = f"### 知识库参考内容：\n{context}"
        system_message = {"role": "system", "content": f"{settings.HR_SYSTEM_PROMPT}\n\n{context_text}"}
        
        # 构造完整的消息列表（包含历史）
        messages = [system_message]
        
        # 添加历史消息 (转换 role 格式)
        for msg in history:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
            
        # 添加当前问题
        messages.append({"role": "user", "content": rewritten_query})
        
        try:
            # 正确调用 LLM (传入消息列表对象)
            response = self.llm.invoke(messages)
            answer = response.content
            
            # 更新历史
            history.append({"role": "user", "content": question})
            history.append({"role": "assistant", "content": answer})
            chat_store[session_id] = history[-10:] # 保留最近10条
            
            return KnowledgeAnswer(answer=answer, source_ids=source_ids)
        except Exception as e:
            logger.error(f"Error in chat_with_knowledge: {str(e)}")
            return KnowledgeAnswer(answer=f"抱歉，处理您的问题时出现了错误。", source_ids=[])

    async def get_ai_tip(self, title: str, content: str) -> str:
        try:
            prompt = f"""
            针对以下招聘知识点，为面试官提供一条简短、专业的面试建议。
            知识点标题：{title}
            知识点内容：{content}
            """
            response = self.llm.invoke(prompt)
            return response.content
        except Exception as e:
            return f"生成提示失败: {str(e)}"

knowledge_service = KnowledgeService()
