# Subject Pack SDK · 多学科技术栈与交互规范

## 一、统一插件接口（生产目标）

```typescript
export type TeachingAction =
 | {type:'setParameters'; params: Record<string,number|string|boolean>}
 | {type:'play'} | {type:'pause'} | {type:'reset'} | {type:'seek'; time:number}
 | {type:'highlight'; target:string} | {type:'compareRuns'; runIds:string[]};

export interface EngineState {
  sceneId: string;
  simulationTime: number;
  parameters: Record<string,unknown>;
  observations: Record<string,number|string>;
}

export interface SubjectEngine {
  readonly id: string;
  readonly version: string;
  readonly capabilities: string[];
  mount(container: HTMLElement, config: unknown): Promise<void>;
  execute(action: TeachingAction): Promise<EngineState>;
  subscribe(listener:(state:EngineState)=>void): ()=>void;
  getState(): EngineState;
  serialize(): unknown;
  restore(snapshot:unknown): Promise<void>;
  dispose(): void;
}

export interface SubjectPack {
  id: string;
  displayName: string;
  themes: string[];
  engineFactories: Record<string,()=>SubjectEngine>;
  templates: Array<{id:string; engine:string; schema:unknown}>;
  validators: string[];
  teachingStrategies: string[];
}
```

未来可将复杂 3D 子引擎加载到 Worker / Canvas / 隔离 iframe。主应用通过受控事件总线收集状态，AI 动作必须先验证再执行。

## 二、七个学科的专业选型

| 学科 | 生产级可视化与交互 | 内容表达 | 学科特有校验 |
|---|---|---|---|
| 数学 | JSXGraph + KaTeX + MathLive + SymPy；三维可用 Three.js | 动态几何、函数、分步代数证明 | 域、数值边界、等价式、反例、公式符号 |
| 物理 | Three.js/React Three Fiber、Matter.js（2D 刚体）、ECharts | 运动轨迹、矢量、波形、电路、图像联动 | 量纲分析、单位、边界条件、物理模型 |
| 化学 | 3Dmol.js、Three.js + 自研实验台 | 分子旋转、原子/键、实验条件 | 配平、原子守恒、结构知识、危险实验边界 |
| 英语 | Web Audio + TTS + ASR Provider + 波形 | 场景对话、发音、听说读写 | 词汇/语法分级、发音置信度、反馈区分 |
| 语文 | Hanzi Writer + SVG/Canvas + TTS | 汉字书写、诗词、课文、人物关系 | 文本出处、字词解释、版本差异 |
| 历史 | MapLibre + D3/ECharts + 3D 文物展示 | 时间轴、地图、贸易网络、文物 | 地名时态、事件日期、地理坐标和来源 |
| 政治 | React Flow + ECharts + 情景决策器 | 制度流程、法律关系、资料比较 | 地区、适用时间、法条来源、观点归属 |

这些是**生产版推荐方案**，不是说示范工程已经安装了这些第三方库。当前 JS 原型采用原生 SVG + CSS + Web Speech，利于离线启动。

## 三、每个学科需要的交付包

```text
subject-packs/<subject>/
  package.json
  manifest.json             # id, version, capabilities, requiredAssets
  theme.tokens.json         # 学科可变主题
  schemas/scene.schema.json # 参数约束
  templates/                # 可重用实验、图表与活动
  renderers/                # 块组件
  engine/                   # 确定性模拟/交互逻辑
  validators/               # 科学与知识审查
  strategies/               # AI教学行动方案
  fixtures/                 # 示例课程与测试数据
  tests/                    # 单元、视觉、端到端
```

## 四、示例场景：平抛运动

- 参数：`speed: 4..13 m/s`，`height:1..3.5m`，`gravity:4..12 m/s²`（演示 UI 可调整，生产需按场景约束）。
- 状态：`t, x, y, vx, vy, speedMagnitude, landingTime, range`。
- 事件：`parametersChanged`、`playbackStateChanged`、`simulationCompleted`、`experimentRecorded`。
- 交互动作：改变初始条件，播放/暂停/复位，定位时间轴，记录和对照多组实验。
- 校验：恒等式 `x=v0*t`、`y=0.5*g*t²`、落地时间由高度决定，忽略空气阻力、水平初速度不改变同高度飞行时间。
- 使用截图作为视觉参考，不采用截图上的物理数值。

## 五、引擎注册与 AI 工具边界

注册时对每个 `engineId` 记录唯一插件版本和 JSON Schema；未经注册的 `engineId` 必须报错。AI 只能输出参数与允许动作，不能写 `eval`、`script`、HTML 或更改来源的权限。复杂场景支持“AI 提议动作 → 规则校验 → 教师同意（必要时）→ 引擎执行 → 状态回传”。

## 六、版权注意

商业产品不能直接复制 CK-12/Brilliant/Labster 的课程内容或 UI 资产。引入第三方引擎和素材前，应核对当时的许可证、商业授权限制、署名义务与资源再分发范围。

## 七、工程版入口与测试

- `content/schemas/scenes.json` 是引擎 ID、模板 ID、参数名、范围、步长和单位的共享契约。
- `packages/subject-sdk/scene.ts` 提供状态订阅、参数更新、播放、暂停、定位、重置。渲染组件位于 `packages/lesson-renderer`。
- 数学支持二次函数、勾股定理、圆与切线。物理支持理想平抛、斜抛与无阻尼弹簧振子，实验记录可以跨参数比较。
- 初中物理通过 `packages/subject-sdk/middle-physics.ts` 提供 17 个确定性模型。物理装置按电磁、力学、热学与光学、运动分组注册，通过 `bench-webgl.ts` 共用三维几何和着色。正文、讲解和实验室使用同一个 Scene，实验记录保存当前参数和模型读数。
- `physics-stage.tsx` 使用射线拾取可操作部件，再沿约束轴把移动换算为注册参数。鼠标、触摸和键盘共用参数步长。电磁感应区分导体位置和速度，拖杆停止后速度、动生电动势与感应电流归零。
- `physics.buoyancy` 通过 `buoyancy-renderer.ts` 使用原生 WebGL。尺寸以 10 cm 为一个场景单位，受力大小由原有确定性模型提供。三维拾取和竖直拖拽见 `buoyancy-space.ts`，相机与 Scene 的物理参数独立。A/B 标记读取已采样深度。
- 带时间轴的引擎在 `scenes.json` 中声明 `playback: true`。参数驱动的模型通过操作即时更新。物理场景支持记录和对照，播放、暂停、定位时间只在支持播放的场景开放。
- 化学支持水分子、配平和稀释。英语支持点餐对话、词汇和听力跟读。语文支持诗词、笔顺和标注。历史支持时间轴、遗址点位和证据。政治支持公共流程、案例选择和角色关系。
- `npm run test:models` 运行科学计算边界。后端测试验证所有教材块及注册表。浏览器覆盖七学科操作。
