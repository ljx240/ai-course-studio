# 后端接口说明（本地示范）

- 默认地址：`http://127.0.0.1:8000`
- 接口文档：`http://127.0.0.1:8000/api/docs`
- 调用方式：标准 HTTP JSON。模型密钥由服务端从单机设置数据库或启动环境读取。
- 静态前端也由同一 FastAPI 服务托管，避免跨域；正式部署需身份认证。

| Method | Endpoint | 当前状态 | 说明 |
|---|---|---|---|
| GET | `/api/health` | 可运行 | 查看后端及是否配置模型 |
| GET | `/api/curricula` | 可运行 | 七学科示范大纲树 |
| GET | `/api/lessons/{id}` | 可运行 | 支持 physics/math/chemistry/chinese/english/history/politics |
| POST | `/api/outline/parse` | 可运行 | 文本与 Markdown 大纲解析 |
| POST | `/api/generate` | 需模型 | 由章节生成受控 Lesson DSL 草稿 |
| POST | `/api/chat` | 需模型 | 基于当前课程与实验数据问答 |

### 导入大纲

```bash
curl -X POST http://127.0.0.1:8000/api/outline/parse \
  -H 'Content-Type: application/json' \
  -d '{"content":"# 第3章 抛体运动\n## 3.2 平抛运动"}'
```

### 生成教材

```json
{
  "subject": "physics",
  "lesson_id": "physics",
  "chapter": "3.2 平抛运动",
  "grade": "高中",
  "style": "explore",
  "requirements": "解释清晰，包含互动实验与习题"
}
```

返回 `{mode:"model",lesson:{...},review_required:true}`；未配置模型返回 HTTP 503；不允许浏览器直接获得 API Key。

### AI 问答

```json
{
  "subject": "physics",
  "lesson_id": "physics",
  "question": "为什么同一高度下飞行时间不随水平初速度变化？",
  "scene_state": {"speed":8.0,"height":2.0,"gravity":9.8}
}
```

正式版必须新增 `/courses`、`/curriculum-nodes`、`/lessons/{id}/versions`、`/publishing`、`/assets`、`/learning-sessions`、`/assessment-attempts` 等具备鉴权与组织隔离的 API。

## 工程版 API

| 接口 | 行为 |
|---|---|
| `GET /api/studio/workspace` | 读取大纲修订号、最新草稿和发布内容 |
| `POST /api/studio/revision` | 比较学科修订号并保存树和教材快照，可同时提交 |
| `GET /api/studio/lessons/{id}/versions` | 查询教材快照及发布记录 |
| `GET /api/studio/lessons/{id}/versions/{version}` | 读取指定快照 |
| `POST /api/studio/lessons/{id}/versions/{version}/publish` | 教师确认发布最新草稿 |
| `POST /api/studio/extract-outline?filename=...` | 以原始文件字节导入 DOCX、PDF 或 UTF-8 文本 |
| `POST /api/studio/standard-mappings` | 关联独立课标要求与知识点 |
| `GET /api/studio/knowledge-points/{id}/standards` | 查找知识点对应的课标 |
| `POST /api/generation/jobs` | 启动整节或单块生成并返回任务 ID |
| `GET /api/generation/jobs/{id}` | 查询进度、已校验草稿或失败信息 |
| `POST /api/studio/tutor` | 用当前教材块和场景状态获取文字及受控动作 |
| `GET /api/settings/ai-provider` | 读取当前配置及密钥状态 |
| `POST /api/settings/ai-provider` | 保存并启用配置 |
| `POST /api/settings/ai-provider/test` | 使用固定探测消息测试提交的配置 |

Provider 的保存与测试接受 `base_url`、`model`、`timeout`（1–600 秒）、`use_api_key` 和可选 `api_key`。同地址提交空密钥可沿用已有凭据。更换地址后需要输入新凭据或显式选择无认证。配置接口仅接受本机来源，读取与保存返回 `has_api_key` 布尔值。测试成功返回 `ok` 和 `model`。

场景动作包含 `scene_id` 与 `engine`。参数变更使用 `parameters`，跳转使用 `time`，内容定位使用 `block_id`。客户端执行前会检查当前上下文。

学伴请求可传 `history`，最多包含三轮 `{question, answer}`。每轮历史回答最多 5000 字符，发送给模型时取前 1500 字符。回复包含 `answer`、通过校验的 `actions` 和 `actions_omitted`。无效动作从列表移除，文字回复可继续使用。模型未提供有效文字时返回 HTTP 502。

`POST /api/generation/outline` 根据教师输入返回可编辑的 Markdown，大纲仅在教师执行导入后保存。整章生成按直接子节点创建各小节任务，所有小节生成成功后由一次工作区修订提交大纲链接及草稿快照。

### 单机整册队列

| 接口 | 行为 |
|---|---|
| `POST /api/generation/books` | 按学科修订号和所选大纲节点提交整册，返回任务 ID |
| `GET /api/generation/books` | 列出任务和小节计数 |
| `GET /api/generation/books/{id}` | 查询整册及各小节状态，成功时返回已保存的修订号 |
| `POST /api/generation/books/{id}/retry` | 重新入队失败任务，复用已生成结果 |
| `GET /api/generation/books/{id}/drafts` | 导出已生成的小节草稿及大纲节点 ID |

创建请求包含 `subject`、`node_id`、`revision`、`mode`、`grade`，并接受现有教材生成参数。模式为 `template` 或 `model`。任务状态为 `queued`、`running`、`failed`、`conflict`、`complete`。
