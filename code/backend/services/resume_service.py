import instructor
from openai import OpenAI
import json
from core.config import settings
from schemas.resume import ResumeParseResponse, ContactInfo
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ResumeService:
    def __init__(self):
        # 初始化 Doubao (Ark) 客户端
        if settings.ARK_API_KEY:
            self.client = OpenAI(
                base_url=settings.ARK_BASE_URL,
                api_key=settings.ARK_API_KEY
            )
            self.client = instructor.from_openai(self.client)
            self.model_name = settings.ARK_MODEL
        else:
            self.client = None
            logger.warning("ARK_API_KEY is not set.")

    async def parse_resume(self, text: str) -> ResumeParseResponse:
        if not self.client:
            raise ValueError("AI Client not configured. Please set ARK_API_KEY.")

        # ===== 优化的系统提示词 (来自 preprocess/resume.py) =====
        system_prompt = """# Role
你是一款高性能的 AI 简历解析引擎，专门负责将非结构化的简历文本转化为高精度的结构化 JSON 数据。

# Extraction Rules (必须严格遵守)
0. **内容识别**：首先判断输入内容是否为一份简历。如果内容与个人职业背景、教育、工作经历完全无关（如：新闻报道、小说片段、无意义乱码、纯代码片段且无个人信息等），请将 `is_resume` 设为 `false`。
1. **实体完整性**：提取工作经历时，必须保留完整的公司全称、职位名称和起止时间。
2. **时间标准化**：将所有日期转化为 YYYY-MM 格式（如 2023.05 -> 2023-05）。如果至今，请填入 "Present"。
3. **技能挖掘**：不仅提取明确列出的技能，还要从项目描述中推断核心技术栈（如提到 "使用 React 开发" -> 技能包含 "React"）。
4. **拒绝幻觉**：严禁编造简历中不存在的学校、公司或联系方式。如果某项信息缺失，请返回 null 或空列表。
5. **复杂文本处理**：如果简历中存在并列的多个教育背景或工作段落，请按时间倒序排列。
6. **上下文智能**：能区分"个人兴趣"与"专业技能"，区分"实习经历"与"正式工作"。
7. **总结生成**：'summary' 字段必须使用中文对候选人进行评价，字数在 200 字左右，包含其核心优势和匹配建议。

# 输出要求
请严格按照提供的 JSON Schema 输出结构，确保所有字段的类型和格式正确。"""

        # ===== 优化的用户提示词 (来自 preprocess/resume.py) =====
        user_prompt = f"""请分析下方简历文本，并提取结构化信息。

## 分析步骤（请按此逻辑思考）：
1. 首先，扫描整个文档，识别所有章节（个人信息、教育、工作、技能等）
2. 对于每个工作经历，仔细提取：公司全称、职位、时间、地点、职责描述
3. 从项目描述中挖掘技术关键词，并归类到技能
4. 验证联系方式的格式（邮箱、电话）
5. 确保所有时间已标准化为 YYYY-MM 格式
6. 最后，按 Schema 要求生成结构化 JSON

## 待处理简历文本：
--- 简历开始 ---
{text}
--- 简历结束 ---

## 特别关注：
1. 从【项目描述】中提取具体技术实现，转化为结构化的技能点
2. 【教育背景】中的专业名称必须与原件完全一致
3. 如果存在多种时间格式（如"2023.5"、"2023年5月"、"May 2023"），统一转为"2023-05"
4. 对于仍在进行的经历，结束时间设为"Present"
5. 仔细区分正式工作和实习经历

请现在开始解析，确保输出完全符合 JSON Schema 要求。"""

        try:
            # 使用 instructor 获取结构化输出
            resume_data = self.client.chat.completions.create(
                model=self.model_name,
                response_model=ResumeParseResponse,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                max_tokens=4000,
            )
            
            # 数据后处理：映射到前端所需的扁平化字段
            self._map_to_frontend_fields(resume_data)
            
            return resume_data
            
        except Exception as e:
            logger.error(f"Error parsing resume with Doubao: {str(e)}")
            raise Exception(f"简历解析失败: {str(e)}")

    def _map_to_frontend_fields(self, data: ResumeParseResponse):
        """将复杂的结构化数据映射到前端 Candidate 接口所需的简单字段"""
        
        # 1. 基础信息提取 (优先从 contact 提取)
        if data.contact:
            data.email = data.contact.email if data.contact.email else data.email
            data.phone = data.contact.phone if data.contact.phone else data.phone
        
        # 2. 姓名处理：去掉空格，确保不是默认值
        name_clean = data.name.strip() if data.name else ""
        has_name = name_clean != "" and name_clean != "未知"
        has_contact = bool(data.email or data.phone)
        
        # 3. 记录日志 (使用 logger 代替 print 以确保在 uvicorn 中可见)
        logger.info(f"--- Resume Mapping Debug ---")
        logger.info(f"Name extracted: '{name_clean}' (has_name: {has_name})")
        logger.info(f"Email: '{data.email}', Phone: '{data.phone}' (has_contact: {has_contact})")

        # 4. 严格的简历判定逻辑 (如果完全没有姓名和联系方式，才判定为非简历)
        if not has_name and not has_contact:
            logger.warning("No name and no contact found. Rejecting as non-resume.")
            data.is_resume = False
            data.parsing_score = 0
            data.summary = "无法识别有效的个人信息（姓名、邮箱或电话），请确保输入的是一份完整的简历。"
            return

        # 5. 计算更真实的解析评分 (加权评分)
        score = 40 # 基础分：只要是简历，至少40分
        
        if has_name: score += 15
        if data.email: score += 10
        if data.phone: score += 10
        
        # 教育背景 (最多15分)
        if data.education and len(data.education) > 0:
            score += min(15, len(data.education) * 10)
            latest_edu = data.education[0]
            data.education_summary = f"{latest_edu.school_name} · {latest_edu.major} ({latest_edu.degree})"
            
        # 工作经历 (最多15分)
        if data.work_experience and len(data.work_experience) > 0:
            score += min(15, len(data.work_experience) * 8)
            data.experience_list = [
                f"{exp.company_name} | {exp.position} ({exp.start_date} - {exp.end_date})"
                for exp in data.work_experience
            ]
            
        # 技能与总结 (最多5分)
        if data.skills: score += 3
        if data.summary and len(data.summary) > 20: score += 2
        
        # 技能标签处理
        data.skill_tags = [skill.name for skill in data.skills]
        if len(data.skill_tags) < 5:
            for exp in data.work_experience:
                data.skill_tags.extend(exp.skills_used)
            data.skill_tags = list(set(data.skill_tags))[:10]

        # 6. 计算工作年限
        total_months = 0
        for exp in data.work_experience:
            try:
                start = datetime.strptime(exp.start_date, "%Y-%m")
                if exp.end_date == "Present":
                    end = datetime.now()
                else:
                    end = datetime.strptime(exp.end_date, "%Y-%m")
                
                months = (end.year - start.year) * 12 + (end.month - start.month)
                if months > 0:
                    total_months += months
            except:
                continue
        data.years_of_experience = round(total_months / 12.0, 1)

        # 最终得分：确保在 40-100 之间，并增加随机微调
        import random
        data.parsing_score = min(100, score + random.randint(-1, 1))
        data.is_resume = True # 强制设为 True，因为已经过了基础校验
        
        logger.info(f"Final calculated parsing_score: {data.parsing_score}")
        logger.info(f"--- End Mapping Debug ---")

resume_service = ResumeService()
