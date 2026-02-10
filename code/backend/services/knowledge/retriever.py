from typing import List
from langchain_core.documents import Document
from langchain_chroma import Chroma
from langchain_community.retrievers import BM25Retriever
from langchain_classic.retrievers import EnsembleRetriever
from langchain_core.embeddings import Embeddings
import jieba
import os
import shutil
import requests
from core.config import settings

class ArkEmbeddings(Embeddings):
    """自定义火山引擎 Embedding 类，确保发送原始字符串"""
    def __init__(self, model: str, api_key: str, base_url: str):
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    def _get_embedding(self, text: str) -> List[float]:
        url = f"{self.base_url}/embeddings"
        # 豆包/火山引擎接口通常要求 input 是列表
        payload = {
            "model": self.model,
            "input": [text] 
        }
        try:
            resp = requests.post(url, headers=self.headers, json=payload, timeout=10)
            if resp.status_code != 200:
                print(f"❌ Ark Embedding API 报错: {resp.status_code} - {resp.text}")
                # 如果模型名称不对，提示用户
                if "Endpoint" in resp.text or "not found" in resp.text:
                    print(f"💡 提示：请确保在 KEY.py 或环境变量中设置了正确的 ARK_EMBEDDING_MODEL (接入点 ID，而非模型名称)")
            resp.raise_for_status()
            data = resp.json()
            return data["data"][0]["embedding"]
        except Exception as e:
            return [0.0] * 1024 # 返回零向量防止程序崩溃

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._get_embedding(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._get_embedding(text)

class ChineseBM25Retriever(BM25Retriever):
    def _tokenize(self, text: str) -> List[str]:
        words = []
        for word in jieba.cut(text):
            word = word.strip()
            if len(word) > 0:
                words.append(word)
        return words

def create_hybrid_retriever(documents: List[Document], embedding_model: Embeddings) -> EnsembleRetriever:
    """创建混合检索器 (Chroma + BM25)"""
    if not documents:
        raise ValueError("文档列表为空，无法创建检索器")

    # 1. 创建 BM25 检索器 (稀疏检索)
    bm25_retriever = ChineseBM25Retriever.from_documents(documents)
    bm25_retriever.k = settings.SPARSE_K
    
    # 2. 创建 Chroma 向量检索器 (稠密检索)
    try:
        # 如果已存在旧的数据库目录，先清理以确保数据一致性（或者你也可以选择增量更新）
        # 这里为了演示简单，我们每次重新创建
        if os.path.exists(settings.CHROMA_DB_PATH):
            shutil.rmtree(settings.CHROMA_DB_PATH)
            
        vectorstore = Chroma.from_documents(
            documents=documents,
            embedding=embedding_model,
            persist_directory=settings.CHROMA_DB_PATH,
            collection_name=settings.COLLECTION_NAME
        )
        dense_retriever = vectorstore.as_retriever(search_kwargs={"k": settings.DENSE_K})
        
        # 3. 混合检索器 (Ensemble)
        ensemble_retriever = EnsembleRetriever(
            retrievers=[bm25_retriever, dense_retriever],
            weights=[0.5, 0.5] # 可以根据效果调整权重
        )
        print(f"✅ Chroma 向量库已就绪，混合检索已启用。存储路径: {settings.CHROMA_DB_PATH}")
        return ensemble_retriever
        
    except Exception as e:
        print(f"⚠️  Chroma 初始化失败，降级仅使用 BM25 检索: {e}")
        return bm25_retriever
