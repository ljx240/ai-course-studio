import schema from '../../content/schemas/lesson.schema.json'
import sceneSpecs from '../../content/schemas/scenes.json'

export const subjectEngines = {
  math: 'math.quadratic',
  physics: 'physics.projectile2d',
  chemistry: 'chemistry.molecule',
  english: 'english.dialogue',
  chinese: 'chinese.poetry',
  history: 'history.timeline',
  politics: 'politics.flow',
} as const

export type Subject = keyof typeof subjectEngines
export type Engine = keyof typeof sceneSpecs

export interface FormulaSymbol {
  symbol: string
  meaning: string
  unit: string
}

export interface WorkedStep {
  title: string
  body: string
  formula?: string | null
}

export const blockLabels = {
  objectives: '学习目标',
  concept: '知识讲解',
  formula: '公式',
  interactive: '互动实验',
  example: '例题',
  assessment: '练习',
  summary: '小结',
  diagram: '图解',
  note: '拓展阅读',
} as const

export interface Block {
  id: string
  title: string
  type: keyof typeof blockLabels
  body?: string | null
  formula?: string | null
  symbols?: FormulaSymbol[] | null
  steps?: WorkedStep[] | null
  engine?: Engine | null
  template?: string | null
  params?: Record<string, number> | null
  question?: string | null
  options?: string[] | null
  answer?: number | null
  explanation?: string | null
  knowledge_points?: string[] | null
}

export interface Lesson {
  id: string
  subject: Subject
  title: string
  number: string
  grade: string
  chapter: string
  theme: string
  version: string
  objectives: string[]
  blocks: Block[]
  generation_mode?: 'template' | 'model' | null
  generation_job?: string | null
}

export function isSubject(value: string): value is Subject {
  return Object.hasOwn(subjectEngines, value)
}

interface Rule {
  type?: string
  anyOf?: Rule[]
  items?: Rule
  additionalProperties?: Rule
  $ref?: string
  minLength?: number
  maxLength?: number
  minItems?: number
  maxItems?: number
  enum?: string[]
}

function matches(value: unknown, rule: Rule): boolean {
  if (rule.$ref) {
    const definition = schema.$defs[rule.$ref.slice('#/$defs/'.length) as keyof typeof schema.$defs]
    return matchesObject(value, definition.properties, definition.required)
  }
  if (rule.anyOf) return rule.anyOf.some((item) => matches(value, item))
  if (rule.enum) return typeof value === 'string' && rule.enum.includes(value)
  if (rule.type === 'null') return value === null
  if (rule.type === 'string') {
    return typeof value === 'string' && value.length >= (rule.minLength ?? 0)
      && value.length <= (rule.maxLength ?? Infinity)
  }
  if (rule.type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (rule.type === 'integer') return typeof value === 'number' && Number.isInteger(value)
  if (rule.type === 'array') {
    return Array.isArray(value) && value.length >= (rule.minItems ?? 0)
      && value.length <= (rule.maxItems ?? Infinity) && value.every((item) => matches(item, rule.items!))
  }
  if (rule.type === 'object' && rule.additionalProperties) {
    return !!value && typeof value === 'object' && !Array.isArray(value)
      && Object.values(value).every((item) => matches(item, rule.additionalProperties!))
  }
  throw new Error('Lesson Schema 使用了未支持的校验规则')
}

function matchesObject(value: unknown, properties: Record<string, Rule>, required: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const object = value as Record<string, unknown>
  return required.every((key) => Object.hasOwn(object, key))
    && Object.entries(properties).every(([key, rule]) => !Object.hasOwn(object, key) || matches(object[key], rule))
}

export function readLesson(value: unknown): Lesson {
  if (!matchesObject(value, schema.properties, schema.required)) throw new Error('教材格式不符合 Lesson Schema')
  const lesson = Object.assign({ version: '1.0.0-draft', number: '1.1', grade: '初中', chapter: '', theme: '' }, value) as Lesson
  if (!isSubject(lesson.subject)) throw new Error('学科未注册')
  const ids = new Set<string>()
  for (const block of lesson.blocks) {
    if (ids.has(block.id)) throw new Error('内容块编号重复')
    ids.add(block.id)
    if (!Object.hasOwn(blockLabels, block.type)) throw new Error('内容块类型未注册')
    if (block.type === 'interactive' && (!block.engine || !Object.hasOwn(sceneSpecs, block.engine) || !block.engine.startsWith(lesson.subject + '.'))) {
      throw new Error('互动引擎未在本学科注册')
    }
    if (block.type === 'assessment' && (!block.question || !block.options || block.answer == null
      || block.answer < 0 || block.answer >= block.options.length)) {
      throw new Error('练习需要有效的题干、选项和正确答案')
    }
  }
  return lesson
}
