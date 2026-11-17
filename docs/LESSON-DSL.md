# Lesson DSL：结构化数字教材规范

## 1. 目的

一个章节在大纲系统中有 `lessonId`，不同草稿/发布快照有 `lessonVersionId`。任何阅读器、备课编辑器、实验演示器、录课工具都消费同一份 Lesson DSL，不分别重建正文。

本包示例：`content/lessons/physics.json`、`content/lessons/math.json`；校验 Schema：`content/schemas/lesson.schema.json`。

## 2. 顶层结构

```typescript
interface Lesson {
  id: string;
  version: string;
  title: string;
  number: string;
  subject: 'math'|'physics'|'chemistry'|'english'|'chinese'|'history'|'politics';
  grade: string;
  chapter: string;
  theme: string;
  objectives: string[];
  blocks: LessonBlock[];
}
```

建议正式版添加 `curriculumNodeId`、`knowledgePointIds`、`sourceReferenceIds`、`editorId`、`reviewState`、`publishedAt`、`engineVersionMap`、`learningDesign`。

## 3. 内容块清单

| `type` | 内容 / 行为 | 典型字段 |
|---|---|---|
| `objectives` | 学习目标 | title；目标引用顶层 objectives |
| `concept` | 概念正文 | body、citations（未来） |
| `formula` | 公式与讲解 | formula、symbols、body、explanation |
| `diagram` | 知识图解 | assetId、caption（未来） |
| `interactive` | 学科交互 | engine、template、params、actions（未来） |
| `example` | 示例题与分步解析 | body、steps |
| `assessment` | 练习与评价 | question、options、answer、explanation |
| `summary` | 章节小结 | body |
| `note` | 注释/方法指导 | body |

目前后端确保类型合法、assessment 选项/答案合法、interactive 引擎符合学科白名单；科学事实与内容引用必须增加专业验证器和人工审核。

### 公式与分步例题

`formula` 仍是字符串。工程版用本地 MathML 渲染，每个换行或括号组外的分号分隔一行。使用 `\frac{分子}{分母}` 写分式、`\sqrt{被开方量}` 写根式、`V_{排}` 写下标、`10^{-4}` 写上标、`\text{ N}` 写单位或中文说明、`\quad` 留出间隔。可直接使用 `×`、`≠`、`ρ` 等字符和现有 Unicode 上下标。这里的写法是有限的数学记号。JSON 字符串中的反斜杠写作 `\\`。

- 公式块的 `symbols` 是按出现顺序组织的 `{symbol, meaning, unit}` 数组。`symbol` 支持上述记号。`body` 说明适用条件与坐标约定，`explanation` 用可朗读的句子解释选公式的依据和用法。
- 例题块的 `body` 写题目。`steps` 依次记录 `{title, body, formula?}`。每步说明这一算式为何成立，在 `formula` 中列出含单位的代入式和结果。
- `symbols` 和 `steps` 可省略，已有教材继续沿用原字段。阅读器、备课预览、课堂和学伴弹窗共用公式排版。课堂语音使用所写的中文讲解和步骤。

## 4. 互动块示例

```json
{
  "id": "exp-projectile-01",
  "type": "interactive",
  "title": "平抛运动：改变初速度与高度",
  "engine": "physics.projectile2d",
  "template": "projectile-horizontal",
  "params": {"speed": 8.0, "height": 2.0, "gravity": 9.8}
}
```

前端不执行 `body` 中的 JS；只通过 Engine Registry 确认交互引擎已安装、版本允许、参数满足约束，再渲染到受控容器中。

## 5. 未来扩充：教学时间轴与 AI 动作

```json
{
  "stepId": "explain-trajectory",
  "narration": "将初速度保持不变，逐步提高抛出高度。",
  "sceneRef": "exp-projectile-01",
  "actions": [
    {"type": "setParameters", "params": {"height": 2.5}},
    {"type": "play"},
    {"type": "highlight", "target": "trajectory"}
  ],
  "checkpoint": {"type": "predict", "question": "飞行时间会变长吗？"}
}
```

动作经独立 Schema 校验；运行时只允许 `SubjectPack.capabilities` 中的动作。AI 负责计划与讲解，专业引擎负责确定性模拟与计算。

## 6. 版本规则

- 可变草稿：`draftVersion` + 每次修改的内容差异。
- 已发布教材：不可变 JSON 快照 + 哈希 + 使用的 Subject Pack 版本。
- 内容迁移：`schemaVersion` 与迁移函数，不能让旧课堂在新组件版本下静默改变答案。
- 资源引用：对象存储 Asset ID，不能把公开或不明来源的 URL 作为唯一来源。

## 7. 概念参考图中的物理数据校验

对平抛模型，令水平方向 x、竖直向下 y，初速度 `v0=8.0 m/s`，高度 `h=2.0 m`，`g=9.8 m/s²`：

```
t = sqrt(2 h / g)           ≈ 0.6389 s
x = v0 t                    ≈ 5.1110 m
vy = g t                    ≈ 6.261 m/s
v = sqrt(v0² + vy²)         ≈ 10.159 m/s
```

有些图像设计稿的速度数值与公式并不一致，前端引擎须以计算模型为准。

## 工程版字段

- `generation_mode` 可为 `template` 或 `model`。模型生成的 `generation_job` 指向阶段记录。编辑后仍可查看来源。
- 练习块可用 `knowledge_points` 关联知识点 ID。个人分析按已有答题记录汇总。
- `interactive.engine` 属于当前学科。模板和数值参数以 `content/schemas/scenes.json` 为准。渲染器只调用注册组件。
- 草稿版本与发布状态由 SQLite 中的快照和发布记录管理。导出的 Lesson JSON 是该快照的可移植内容。
