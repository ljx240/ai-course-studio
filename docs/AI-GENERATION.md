# AI 大纲驱动教材工厂 · 生成方案

## 1. 工作流

```
导入大纲/课程标准
  → 解析结构（包含不确定性提示）
  → 教师确认章节树
  → 映射知识点、前置知识与课时目标
  → 教材策划：章节大纲 + 内容块蓝图
  → 权威教材/授权资源检索、来源追踪
  → 学科模型与模板选型
  → 分块生成正文/题目/互动配置
  → DSL Schema 校验
  → 科学计算/事实/来源校验
  → 教师/教研审核
  → 发布不可变教材版本
```

每一步产物保存版本和来源，支持只重生成一个内容块，而不是整节推翻。

## 2. 输入契约

```json
{
  "curriculumNodeId": "node-physics-3-2",
  "curriculumVersion": "demo-2026",
  "subject": "physics",
  "grade": "高中",
  "chapter": "3.2 平抛运动",
  "lessonMinutes": 40,
  "teachingStyle": "exploratory",
  "requiredCapabilities": ["interactive", "assessment", "workedExample"],
  "allowedEngines": ["physics.projectile2d"],
  "knowledgePointIds": ["kp-projectile-def", "kp-projectile-motion"],
  "resourceRefs": [],
  "requirements": "重视运动分解与探究实验"
}
```

## 3. 内容生成策略

- 规划层：确定学习目标、内容块类型、互动数量、误区、练习分层；禁止一次请求要求完整一册正文。
- 知识层：从结构化参考资料与可信来源检索概念、事实和例题；AI 标记每个重要断言的参考来源与置信度。
- 交互层：先选择成熟模板并生成参数；只有模板覆盖不足时，才请求新增受控组件开发任务。
- 校验层：基于规则引擎验证公式、边界条件、答案和实验模型。对不可自动验证的内容输出教师复核项。
- 排版层：编辑器按学科主题渲染真实图文/公式/场景，不让模型自由生成未经审查的 HTML 或 JS。

## 4. 模型接口约定

当前 `api/main.py` 接收：

`POST /api/generate` → `GenerateRequest {subject,lesson_id,chapter,grade,style,requirements}`

后端发送 `stream:false` 的 Chat Completions 请求，期望模型只返回 JSON，再使用 Pydantic 校验允许的 block.type 与 engine。缺失字段、未知学科插件和答题索引错误直接拒绝。返回：

```json
{
  "mode": "model",
  "review_required": true,
  "lesson": {"id":"physics","subject":"physics","title":"...","version":"1.0.1-ai-draft","objectives":["..."],"blocks":["..."]}
}
```

上述为形状示意；具体输出需符合 `content/schemas/lesson.schema.json`，字符串占位符不是可直接提交的教材。

## 5. 教学真实性与引用

- 历史、政治：必须标明地理范围、时间与原始材料；分清史实、解释、观点。
- 数学、物理、化学：校验单位、定义域、可观测条件、公式、化学配平，必要时提供推导证据。
- 语文、英语：原文/音频的版权来源与字句完整性；音素、语法与解释的层级适配。
- 学生数据：只收集教学必需信息；模型调用不应传出私人身份和敏感记录。

## 6. 异步与批量生成（目标版本）

```text
GenerateBookJob
  bookId
  inputCurriculumVersion
  chapterJobs[]
    lessonJobs[]
      outlineDraft
      contentDrafts[]
      interactiveDrafts[]
      validationReports[]
      reviewState
      versionId
```

以 queue/job 处理长任务，可重试失败内容块并避免重复生成。支持人工中断和部分章发布。状态必须明确：`queued/running/needs-review/published/failed`，不允许伪造已完成。

## 7. 本包实现和限制

离线模式可用「复制教材模板」创建可编辑草稿。工程版「AI 服务设置」可保存并测试 Provider。使用模型生成的草稿需经教师核对知识、公式和例题后发布。

## 工程版任务接口

工程版通过 `POST /api/generation/jobs` 创建任务，浏览器轮询任务阶段。记录包括大纲解析、目标与顺序规划、生成正文、匹配已注册模板、结构校验和教师复核。选中内容块可单独重生成，其他块随原教材保存。发布是独立的版本操作。

整册生成通过 `POST /api/generation/books` 提交所选节点的全部小节。SQLite 记录每节状态，工作线程按目录顺序处理。浏览器关闭后任务继续，本机服务重启后恢复未完成小节。全部生成成功时批量保存为草稿。修订冲突时可下载已有结果，失败时可重试剩余小节。

当前自动校验覆盖 DSL、场景契约和练习索引。学科事实、推导与资料来源由教师确认。工程验收用本机兼容协议夹具运行，真实模型及知识库检索需在部署环境继续验收。
