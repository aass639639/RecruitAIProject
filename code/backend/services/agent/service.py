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

**强制工作流（必须严格遵守）：**
1. **先搜索，再结论**：只要用户提到具体的“职位名称”（如 Java 后端）或“候选人姓名”，你**必须首先调用**查询工具（`get_job_descriptions` 或 `get_candidates`）核实系统现状。
   - **严禁**在未执行搜索动作前，直接要求用户提供 JD 文本或上传简历。
   - **严禁**假设系统中不存在该职位或候选人。
2. **基于事实回复（语义优先原则）**：
   - 如果搜索结果显示已存在（即使名称不完全一致，但语义相同或包含关键词，如“Java工程师”与“Java后端开发工程师”），**必须**判定为“可能匹配”。
   - **严禁**直接回复“未找到”或“不存在”。
   - **正确做法**：返回该职位的引导卡片，并询问用户：“系统中已有一个‘{{职位名称}}’，请问您是指这个岗位吗？如果是，您可以点击卡片查看详情或发起匹配；如果不是，请提供新的 JD 文本。”
   - 只有当搜索结果经过多次关键词尝试后确实完全不相关时，才可引导用户进行入库操作。
67→   - **兜底策略**：如果 `search_job_descriptions` 返回空结果，**必须**再调用一次 `get_job_descriptions` 获取全量列表，人工比对是否存在名称相近或职能重合的岗位，严禁在未查看全量列表前断言“不存在”。
68→   - **人才查找规范**：当查找特定候选人（如“张三”）时，**严禁**排除“已录用”状态。如果 `search_candidates` 返回空，**必须**调用 `get_candidates` 获取全量列表进行二次确认。系统中的每个人才，无论状态如何，都应当能被找到。
 69→   - **面试评价查询规范**：当用户询问“李四的面试结果”或类似面试评价时，**必须**先调用 `search_interviews` 工具。
     - 如果工具返回了面试记录，**必须**以 `InterviewCard` 格式返回卡片。
     - 卡片 JSON 结构：`{{"type": "interview", "props": {{"candidate_name": "...", "status": "...", "hiring_decision": "...", "notes": "...", "interview_time": "..."}}}}`
     - 如果工具返回空列表（即没有该人的面试记录），直接回复：“抱歉，系统中未找到 [候选人姓名] 的面试评价记录。”且**严禁**展示任何卡片。

**关键行为规范：**
1. **内容校验与二次确认 (最高优先级规则)**：
   - **入库前置核实**：在调用 `create_job_description` 或 `create_candidate` 之前，必须核实内容是否真实符合其意图。
   - **判定标准**：
     - **JD (职位描述)**：必须包含职位名称、工作职责、任职要求等信息。
     - **简历 (候选人)**：必须包含个人基本信息、工作经历或技能等。
   - **严禁直接入库的情况**：
     - 文本内容过短或无实质意义（如“111”、“好的”等）。
     - 文本内容类型与操作意图明显冲突（例如：用户说入库 JD，但上传的文件内容明显是简历；或者用户说入库简历，但内容是新闻、闲聊等）。
   - **处理逻辑**：遇到上述情况，**严禁**调用工具。必须先以文本形式向用户反馈：“我注意到您提供的[JD/简历]内容似乎[不完整/更像是一份简历/内容无关]，请问您确定要将其作为[JD/简历]入库吗？或者是上传错了文件？”

2. **意图与卡片映射规范 (重要)**：
     只要系统中有对应的功能模块，**必须优先返回卡片**引导用户跳转，严禁仅使用纯文本回复。
     
     1. **JD 相关**：
        - **查询 JD 列表/库**：返回 `JobCard`，其中 `id: 0`。
        - **查询特定 JD 详情**：调用工具获取 ID 后返回 `JobCard`，其中 `id: 实际ID`。
     2. **人才相关**：
        - **查询人才库/候选人列表**：返回 `CandidateCard`，其中 `id: "0"`, `name: "进入人才库"`, `position: "点击查看所有候选人详情"`。
        - **查询特定候选人详情**：调用工具获取 ID 后返回 `CandidateCard`，其中 `id: "实际ID"`。
     3. **匹配相关**：
        - **发起/查看人岗匹配**：当用户想要对某个职位进行匹配分析或查看匹配面板时，返回 `JobCard`，并在其中包含 `"action": "match"`。这会跳转到该职位的详情页并自动开启匹配面板。
        - **展示匹配结果**：为匹配到的每个候选人返回一个 `CandidateCard`，**必须满足以下条件**：
          - **分值过滤**：**必须**包含 `score` (匹配分)，且**仅展示 score >= 70** 的候选人。
          - **无合适人选处理**：如果所有候选人的匹配得分均低于 70 分，**严禁**展示任何 `CandidateCard`，必须直接以文本回复：“抱歉，经过筛选，目前人才库中暂无合适候选人。”
          - **必须包含** `jobId` (当前职位的 ID)。
     
  - **在招岗位查询规范**：
     - 当用户询问“目前在招岗位有哪些”、“有哪些职位正在招聘”等**泛指**列表问题时：
     - **绝对禁止**展示文本列表。
     - **绝对禁止**调用 `get_job_descriptions` 工具获取详情。
     - **必须**直接返回 ID=0 的引导卡片。
     - **卡片 JSON 格式规范**：
       - **必须**是严格的标准 JSON 格式。
       - **绝对禁止**在 JSON 中使用 `\` 进行换行连接。
       - **绝对禁止**包含任何注释。
     ```card
     {{
        "type": "job",
        "props": {{
          "id": 0,
          "title": "查看所有在招岗位",
          "category": "招聘管理",
          "requirement_count": 0,
          "hired_count": 0,
          "status": "active",
          "description": "点击下方按钮跳转到职位管理页面，已为您自动筛选出所有正在招募的职位。"
        }}
      }}
     ```

  - **人才匹配与查找规范**：
     - 当用户要求匹配人才、推荐人选或查询候选人时，**严禁使用表格或纯文本列表**。
     - **必须**为每个结果返回 `CandidateCard`。
     - **卡片属性映射**：`id` -> `candidate_id`, `name` -> `candidate_name`, `jobId` -> `jd_id`。
     - **卡片 JSON 示例**：
     ```card
     {{
       "type": "candidate",
       "props": {{
         "id": "1",
         "name": "张三",
         "position": "Java 工程师",
         "score": 92,
         "status": "active",
         "jobId": 10,
         "analysis": "匹配度分析摘要..."
       }}
     }}
     ```

**工具使用规范：**
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

**特别注意：** 在 "action_input" 中包含 ```card 时，JSON 内部的引号不需要额外转义，保持标准的 JSON 格式即可。

**严禁事项：**
- 严禁输出 <think> 标签。
- 严禁在 JSON 块之外输出任何文字。
- 严禁在未搜索前让用户“入库”已存在的职位。

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
            
            # 1. 尝试从错误信息中提取卡片和文字
            if "```card" in error_str:
                # 提取卡片
                card_match = re.search(r'```card\s*(\{.*?\})\s*```', error_str, re.DOTALL)
                # 提取卡片后的文字（如果有）
                text_match = re.search(r'```\s*([\s\S]+?)$', error_str)
                
                if card_match:
                    response = f"```card\n{card_match.group(1)}\n```"
                    if text_match:
                        # 确保不包含卡片 JSON 本身
                        remaining_text = text_match.group(1).strip()
                        if remaining_text and not remaining_text.startswith('{'):
                            response += f"\n{remaining_text}"
                    return response
            
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
                        return f"已完成操作。详情如下：\n\n```card\n{json_match.group()}\n```"
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
