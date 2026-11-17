# Codex / CodeAgent 可执行开发任务

下面各任务可以分别输入 AI Coding 工具。执行每项前必须读取根目录 `AGENTS.md`。

## 任务 01：重构成生产前端基础工程

> 读取 AGENTS.md、docs/PRD.md、docs/DESIGN.md、docs/ARCHITECTURE.md。以现有 web/ 为功能基线，以 design/参考设计图/01-互动教材阅读器.png 及另外四张设计参考为视觉标准，建立 React + TypeScript + Vite 的可运行 Monorepo。完成五个主路由（课程大纲、互动教材、AI备课、沉浸实验室、练习分析），迁移 design tokens，保留七学科切换、原有教材 DSL 与物理/数学交互。不要连接互联网字体或 CDN，不要重新设计成通用 SaaS 风格。交付 README、路由测试、可运行脚本与实测截图，必须说明与原生 JS 演示之间的功能差异。

## 任务 02：完善大纲树与教材持久化

> 读取 docs/CURRICULUM-SCHEMA.md、docs/LESSON-DSL.md 与 api/main.py。将目前的示范大纲扩展为可存储的分层数据模型，建立 Curriculum、CurriculumNode、Lesson、LessonVersion、KnowledgePoint 与知识标准映射，优先实现 Markdown/DOCX/PDF 导入、节点预览纠错、增加/移动/删除/排序、选中节点进入教材、按节点新建草稿及已发布版本查看。不得把大纲目录和课程标准混为同一表。编写接口测试，包含编号保留、多教材版本和移动层级的校验。

## 任务 03：AI 教材工厂 V1

> 读取 docs/AI-GENERATION.md、docs/LESSON-DSL.md、docs/SUBJECT-SDK.md。将 api/main.py 中的简单示范生成接口重构为可追踪的生成 pipeline：OutlinePlan、BlockPlan、ContentDraft、InteractiveTemplateConfig、ValidationReport、TeacherReview。兼容 OpenAI-compatible API（支持自建 NewAPI），密钥由本机后端保管。模型只生成 Schema 合法的 DSL，不允许在浏览器执行模型生成的任意代码。生成失败需返回可恢复错误。先以“高中物理·平抛运动”生成一节标准教材并输出真实生成日志、校验结果和对照截图。

## 任务 04：物理学科专业化引擎

> 保留现有 2D 理想平抛模型作为正确性回归数据。将 Web 交互插件规范化，新增可复用模板：水平抛体、斜抛运动、简谐振动。支持参数滑块、轨迹、受力/速度矢量、关键物理量实时图表、实验记录与对照。标注模型假设与单位，建立数值回归测试与场景性能测量。遵循同一 SubjectEngine 接口，保证教材内嵌和沉浸实验室共用场景状态。

## 任务 05：数学学科专业化引擎

> 将原生 SVG 二次函数演示升级为 JSXGraph + KaTeX / MathLive，并将纯计算代码保留为测试基准。支持拖动点、修改系数、显示顶点/根与对称轴、显示公式步骤。学科教材排版要接近高品质数字出版物，而不是仪表盘。优先实现二次函数、勾股定理、圆与切线三个可复用模板。

## 任务 06：构建教材智能讲解动作协议

> 依据 docs/SUBJECT-SDK.md 设计 AI Tutor Action Registry，完成 setParameters / play / pause / seek / highlight / showFormula 的受控执行，不允许模型生成脚本直接运行。支持学生追问打断和恢复既有讲解步骤。实现教材状态快照、场景动作审计、工具错误恢复和测试用例。

## 任务 07：设计与功能验收

> 使用 design/参考设计图 与 design/实际运行截图 审核五个主页面的布局、字号、空白、公式与图表，输出差异报告。自动运行 tests/ 下的算法、Schema 和浏览器流程，并补充 1440/1600 桌面以及移动端截图。检查数学与物理教学数值正确性、离线可用性、模型降级提示和真实数据/示例数据区分。
