import re
import json
from typing import List, Dict, Any, Union
import logging
from langchain_openai import ChatOpenAI
from langchain_classic.agents import AgentExecutor, create_structured_chat_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate, HumanMessagePromptTemplate
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.outputs import ChatResult, ChatGeneration
from core.config import settings
from .tools import get_all_tools

logger = logging.getLogger(__name__)

class DeepSeekChatOpenAI(ChatOpenAI):
    """
    针对 DeepSeek 模型的包装器，自动移除 <think> 标签及其内容
    """
    def _generate(self, *args, **kwargs) -> ChatResult:
        result = super()._generate(*args, **kwargs)
        for generation in result.generations:
            if isinstance(generation, ChatGeneration) and hasattr(generation.message, "content"):
                # 移除 <think> 标签及其内容
                content = generation.message.content
                if "<think>" in content:
                    new_content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
                    generation.message.content = new_content
        return result

    async def _agenerate(self, *args, **kwargs) -> ChatResult:
        result = await super()._agenerate(*args, **kwargs)
        for generation in result.generations:
            if isinstance(generation, ChatGeneration) and hasattr(generation.message, "content"):
                # 移除 <think> 标签及其内容
                content = generation.message.content
                if "<think>" in content:
                    new_content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
                    generation.message.content = new_content
        return result

class AgentService:
    def __init__(self):
        # 1. 初始化 LLM (使用包装后的模型)
        self.llm = DeepSeekChatOpenAI(
            model=settings.LLM_MODEL,
            api_key=settings.ARK_API_KEY,
            base_url=settings.ARK_BASE_URL,
            temperature=0,
        )
        
        # 2. 加载工具
        self.tools = get_all_tools()
        
        # 3. 定义 System Prompt
        system_prompt = """你是一个专业的智能招聘助手。
你的目标是协助 HR 完成简历筛选、人才匹配、面试准备和知识查询等任务。

你拥有以下工具：
{tools}

你可以调用的工具列表：[{tool_names}]

**输出协议：**
你必须输出一个 JSON 对象。
格式：
```json
{{
  "action": "工具名称或 Final Answer",
  "action_input": "工具输入参数或回复内容"
}}
```

**关键规则：**
1. **工具调用**：必须使用 "action" 字段指定工具名。
2. **最终回复**：必须使用 "action": "Final Answer"。
3. **卡片展示**：如果工具返回了 ```card 内容，请直接将其放入 "action_input" 中。不要修改它。

**严禁事项：**
- 严禁输出 <think> 标签。
- 严禁在 JSON 块之外输出任何文字。

当前时间: {current_date}
"""
        
        # 4. 创建 Prompt Template
        self.prompt = ChatPromptTemplate.from_messages([
            SystemMessagePromptTemplate.from_template(system_prompt),
            MessagesPlaceholder(variable_name="chat_history"),
            HumanMessagePromptTemplate.from_template("{input}\n\n{agent_scratchpad}"),
        ])
        
        # 5. 创建 Agent
        self.agent = create_structured_chat_agent(self.llm, self.tools, self.prompt)
        
        # 6. 创建 Executor
        def _handle_error(error) -> str:
            error_str = str(error)
            logger.warning(f"Agent Parsing Error: {error_str}")
            
            # 1. 强制检查是否包含卡片 JSON，如果包含，直接作为最终结果提取并返回
            # 这种情况通常是模型正确调用了工具，但返回结果时格式崩溃
            if "```card" in error_str:
                card_match = re.search(r'```card\s*(\{.*?\})\s*```', error_str, re.DOTALL)
                if card_match:
                    return f"已完成操作。具体信息如下：\n\n```card\n{card_match.group(1)}\n```"
            
            # 2. 尝试从错误信息中提取任何 JSON 块
            json_match = re.search(r'\{.*\}', error_str, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group())
                    # 如果是 Final Answer
                    if data.get("action") == "Final Answer":
                        return data.get("action_input", "")
                    # 如果是一个卡片对象本身
                    if "type" in data and "props" in data:
                        return f"已完成入库。详情如下：\n\n```card\n{json_match.group()}\n```"
                except:
                    pass
            
            # 3. 如果实在无法解析，返回一个让 Agent 能够“清醒”过来的指令
            return "你的输出格式错误。请不要输出任何思考过程或额外文字，直接以 JSON 格式输出：{\"action\": \"Final Answer\", \"action_input\": \"你的回答\"}"

        self.executor = AgentExecutor(
            agent=self.agent,
            tools=self.tools,
            verbose=True,
            handle_parsing_errors=_handle_error,
            max_iterations=10
        )

    async def chat(self, user_input: str, chat_history: List[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        处理用户对话
        """
        # 转换历史格式
        formatted_history = []
        if chat_history:
            for msg in chat_history:
                if msg["role"] == "user":
                    formatted_history.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    formatted_history.append(AIMessage(content=msg["content"]))
        
        try:
            # 获取当前日期
            from datetime import datetime
            current_date = datetime.now().strftime("%Y-%m-%d")
            
            # 执行 Agent
            response = await self.executor.ainvoke({
                "input": user_input,
                "chat_history": formatted_history,
                "current_date": current_date
            })
            
            return {
                "answer": response["output"],
                "status": "success",
                "history": chat_history + [
                    {"role": "user", "content": user_input},
                    {"role": "assistant", "content": response["output"]}
                ]
            }
        except Exception as e:
            logger.error(f"Agent execution error: {str(e)}")
            return {
                "answer": f"抱歉，我遇到了一点问题：{str(e)}",
                "status": "error",
                "history": chat_history + [
                    {"role": "user", "content": user_input},
                    {"role": "assistant", "content": f"错误：{str(e)}"}
                ]
            }

# 实例化单例，供 API 路由调用
agent_service = AgentService()
