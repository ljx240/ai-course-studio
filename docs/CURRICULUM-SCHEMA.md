# 大纲树 / 课程标准 / 知识点模型

## 1. 两棵树：教学标准与教材目录

**课程标准树**：地区与学段 → 学科 → 领域 → 核心素养/课程要求。记录来源版本、生效时间和证据链接。

**教材目录树**：学段 → 学科 → 书册 → 章 → 节 → 知识点。适配各教材版本和组织方式。

多对多表 `standard_knowledge_mappings` 将课程标准与知识点关联。一个知识点可跨教材版本映射多个章节。不要把教材章节文本直接作为知识点的唯一 ID。

## 2. CurriculumNode

```typescript
export type NodeType = 'school'|'subject'|'textbook'|'chapter'|'section'|'lesson'|'knowledgePoint';
export interface CurriculumNode {
  id: string;
  parentId?: string;
  curriculumId: string;
  type: NodeType;
  title: string;
  code?: string;                     // 如 3.2.1
  order: number;
  children?: CurriculumNode[];        // API 可以按需装载
  knowledgePointIds?: string[];
  lessonIds?: string[];
  plannedMinutes?: number;
  status?: 'empty'|'draft'|'review'|'published';
  sourceReferenceIds?: string[];
}
```

导入服务输出 `ImportResult={ nodes, warnings, extractedStandards, sourceFileId }`。人工确认后才写入正式目录。

## 3. 节点操作

- 导入：支持 Markdown → DOCX/PDF/XLSX（逐步）。对标题层级、编号、同名项提供纠错视图。
- 编辑：增删改、拖放/合并、历史、批量操作。移动节点必须维护顺序与跨课程标准关联。
- 生成：选一节、一个章或整个册，构造 GenerateJob；按小节并行、按知识点序列审核。
- 导航：按章节树选择课程，显示发布版本、课时、知识点、资源和完成度。
- 导出：标准化树 JSON / 教材包 JSON / 后续支持 SCORM/H5P 兼容导出（评估后实现）。

## 4. 导入示范

```
# 第3章 抛体运动
## 3.1 曲线运动
## 3.2 平抛运动
### 3.2.1 位移规律
### 3.2.2 速度规律
## 3.3 斜抛运动
```

会变成保留标题编号的父子树。前端演示有导入、显示和选中；目前完整多版本持久化与批量任务待开发。

示例数据：`content/curricula/demo-syllabus.json`。
