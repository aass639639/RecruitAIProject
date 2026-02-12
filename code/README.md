# RecruitAI - 智能招聘助手系统

这是一个基于 FastAPI 后端和 React 前端的智能招聘助手系统。它集成了简历解析、人才管理、面试辅助等 AI 驱动的功能。

## 项目结构

- `backend/`: 基于 FastAPI 的后端服务
- `web/fontend/`: 基于 React + Vite + TypeScript 的前端应用

---

## 快速启动指南

### 1. 后端启动步骤 (Backend)

进入后端目录并配置环境：

```bash
# 进入后端目录
cd backend

#删除旧环境并新建虚拟环境 (推荐)
rm -rf venv
python -m venv venv

# 激活虚拟环境 (MacOS/Linux)
source venv/bin/activate
# Windows 激活虚拟环境
# .\venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

#### 环境变量配置
在 `backend/core/KEY.py` 文件中修改 AI 模型密钥（Gemini 和 豆包/Ark）：

```python
# Gemini 配置（暂时无用）
GEMINI_API_KEY = "你的_GEMINI_KEY"

# Doubao (Ark) 配置
ARK_API_KEY = "你的_ARK_KEY"
ARK_MODEL = "doubao-1-5-pro-32k-250115" #可以更换成你的model
```

#### 运行后端
```bash
uvicorn main:app --reload --port 8000
```
后端服务将运行在: [http://localhost:8000](http://localhost:8000)

---

### 2. 前端启动步骤 (Frontend)

进入前端目录并启动开发服务器：

```bash
# 进入前端目录
cd web/fontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```
前端应用将运行在: [http://localhost:5173](http://localhost:5173) (具体端口请查看终端输出)

---

## 核心功能

1. **智能知识库 (HR RAG)**: 
    - **检索增强生成**: 基于 RAG 技术，支持对录入的 HR 文档进行深度理解和问答。
    - **混合检索**: 结合 Chroma 向量数据库 (语义搜索) 与 BM25 (关键词搜索)，确保检索精度。
    - **智能处理**: 集成意图识别与查询重写，能更准确地理解用户意图。
    - **可视化引用**: 答案自动关联原始文档，支持点击跳转查看详情。
2. **简历解析 (Resume Parser)**: 自动提取简历中的姓名、联系方式、工作经验和技能点。
3. **人才库管理 (Talent Pool)**: 结构化存储候选人信息，支持搜索和筛选。
4. **面试辅助 (Interview Assistant)**: 根据候选人背景和 JD 自动生成面试题目和评分维度。
5. **岗位匹配 (Job Matcher)**: (开发中) 智能匹配候选人与职位描述。
6. **招聘培训 (Recruit Training)**: (开发中) 为新入职人员推荐培训路径。

## 技术栈

- **后端**: FastAPI, SQLAlchemy, SQLite, LangChain, ChromaDB, rank_bm25
- **前端**: React 19, Vite, Tailwind CSS, Lucide React, Zustand (状态管理)
- **AI**: 豆包 (Ark) LLM & Embedding, Gemini
