import json
from typing import Dict, List, Optional
from enum import Enum
from langchain_openai import ChatOpenAI

class QueryCategory(Enum):
    """查询分类"""
    GREETING = "greeting"  # 问候
    SMALL_TALK = "small_talk"  # 闲聊
    VAGUE = "vague"  # 模糊问题
    HR_QUERY = "hr_query"  # HR具体问题
    OTHER = "other"  # 其他

class SimpleIntentRecognizer:
    """
    极简意图识别器
    """
    def __init__(self, llm_client: ChatOpenAI):
        self.llm = llm_client

    def categorize(self,
                   question: str,
                   chat_history: Optional[List[Dict]] = None) -> Dict:
        """
        分类用户查询
        """
        prompt = self._build_thinking_prompt(question, chat_history)

        try:
            response = self.llm.invoke(prompt)
            result = self._parse_response(response.content)
            return result
        except Exception as e:
            print(f"⚠️  意图识别失败：{e}")
            return self._get_default_result(question)

    def _build_thinking_prompt(self,
                               question: str,
                               chat_history: Optional[List[Dict]]) -> str:
        context = ""
        if chat_history:
            context = "\n## 对话上下文：\n"
            for msg in chat_history[-4:]:
                role = "用户" if msg.get("role") == "user" else "助手"
                context += f"{role}: {msg.get('content', '')}\n"

        prompt = f"""
请分析用户的输入，判断应该如何处理。

## 用户输入：
"{question}"

{context}

## 请思考：
1. 用户是在打招呼、闲聊，还是有实际问题要问？
2. 如果是问题，表达清楚吗？还是需要进一步澄清？
3. 这是关于HR（人力资源）的问题吗？

## 分类选项：
- greeting: 问候（如"你好"、"早上好"）
- small_talk: 闲聊（如"今天天气不错"）
- vague: 模糊问题（如"那个事情怎么办"、"还需要什么"）
- hr_query: HR具体问题（如"请假流程"、"年假多少天"）
- other: 其他问题

## 请输出JSON格式：
{{
    "category": "greeting/small_talk/vague/hr_query/other",
    "confidence": 0.0-1.0,
    "needs_clarification": true/false,
    "needs_retrieval": true/false,
    "reason": "判断理由"
}}
"""
        return prompt

    def _parse_response(self, content: str) -> Dict:
        try:
            # 提取 JSON 部分
            start = content.find('{')
            end = content.rfind('}') + 1
            if start != -1 and end != -1:
                json_str = content[start:end]
                return json.loads(json_str)
            return self._get_default_result("")
        except:
            return self._get_default_result("")

    def _get_default_result(self, question: str) -> Dict:
        return {
            "category": "hr_query",
            "confidence": 0.5,
            "needs_clarification": False,
            "needs_retrieval": True,
            "reason": "默认分类"
        }
