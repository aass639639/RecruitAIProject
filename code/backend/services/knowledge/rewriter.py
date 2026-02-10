import re
import hashlib
from typing import List, Dict, Optional
from langchain_openai import ChatOpenAI

class SimpleQueryRewriter:
    """
    简化版查询重写器
    """
    def __init__(self, llm_client: ChatOpenAI, enable_cache: bool = True):
        self.llm = llm_client
        self.enable_cache = enable_cache
        self.cache = {} if enable_cache else None

    def rewrite(self, question: str, chat_history: List[Dict] = None) -> str:
        if not question or not isinstance(question, str):
            return question

        question = question.strip()
        if not question:
            return question

        if chat_history is None:
            chat_history = []

        # 执行重写
        result = self._perform_rewrite(question, chat_history)
        return result

    def _perform_rewrite(self, question: str, chat_history: List[Dict]) -> str:
        if not chat_history:
            return question

        context = ""
        for msg in chat_history[-4:]:
            role = "用户" if msg.get("role") == "user" else "助手"
            context += f"{role}: {msg.get('content', '')}\n"

        prompt = f"""
基于对话上下文，将用户的最新提问重写为一个独立、完整的提问。
重写后的问题应该不需要上下文就能被理解，且适合在知识库中检索。

## 对话上下文：
{context}

## 用户最新提问：
"{question}"

## 要求：
1. 补全代词（如“他”、“那个”、“这种”）指代的对象。
2. 补全省略的主语或宾语。
3. 保持原意，不要添加额外问题。
4. **只返回重写后的提问文本，不要包含任何解释、前缀或引号。**
5. 如果原提问已经很完整，直接返回原提问。

## 独立提问：
"""
        try:
            response = self.llm.invoke(prompt)
            return response.content.strip().strip('"')
        except:
            return question
