import curriculum from '../../../content/curricula/demo-syllabus.json'
import { isSubject, type Block, type Lesson, type Subject } from '../../../packages/lesson-schema'
import { legacy, type OutlineNode } from '../../../packages/subject-sdk/legacy'
import type { Parameters } from '../../../packages/subject-sdk'

export const { subjects } = legacy.data
const lessonFiles = import.meta.glob<Lesson>('../../../content/lessons/*.json', { eager: true, import: 'default' })
export const lessons = new Map(Object.values(lessonFiles).map((lesson) => [lesson.id, lesson]))
type SeedNode = Omit<OutlineNode, 'children' | 'subject'> & { subject?: string; children?: SeedNode[] }

function seedNode(node: SeedNode, inherited?: Subject): OutlineNode {
  const subject = node.subject && isSubject(node.subject) ? node.subject : inherited
  return { ...node, subject, children: (node.children ?? []).map((child) => seedNode(child, subject)) }
}

export const seedOutline = curriculum.nodes.map((node) => seedNode(node))
export const parseOutline = legacy.store.outlineFromText
export const exportJson = legacy.store.exportJson

export const nav = [
  ['reader', 'book', '数字教材'],
  ['outline', 'layers', '课程大纲'],
  ['editor', 'pen', 'AI 备课'],
  ['lab', 'flask', '实验室'],
  ['quiz', 'chart', '练习分析'],
] as const
export type View = typeof nav[number][0] | 'classroom'

export interface Attempt {
  lesson: string
  block: string
  choice: number
  correct: boolean
  date: string
}

export interface ExperimentRun {
  parameters: Parameters
  metrics?: Record<string, string>
  flight?: number
  range?: number
  date: string
}

export interface LocalData {
  drafts: Record<string, Lesson>
  published: Record<string, Lesson>
  outlines: Partial<Record<Subject, OutlineNode[]>>
  notes: Record<string, string[]>
  checks: Record<string, number[]>
  visited: Record<string, string[]>
  attempts: Attempt[]
  runs: Record<string, ExperimentRun[]>
}

export interface Workspace {
  outlines: LocalData['outlines']
  drafts: LocalData['drafts']
  versions: Record<string, number>
  revisions: Partial<Record<Subject, number>>
  published: Record<string, Lesson>
}

export interface Version {
  id: number
  created_at: string
  published_at: string | null
  reviewer: string | null
}

const storageKey = 'zhijing.course.studio'
const empty: LocalData = { drafts: {}, published: {}, outlines: {}, notes: {}, checks: {}, visited: {}, attempts: [], runs: {} }

export function readLocal(): LocalData {
  const raw = localStorage.getItem(storageKey)
  if (raw) return { ...empty, ...JSON.parse(raw) }
  // Migrate V0.2 user data when both entries are served from the same origin.
  const previous = localStorage.getItem('zhijing.course.studio.v2')
  if (!previous) return empty
  const old = JSON.parse(previous)
  return {
    ...empty,
    drafts: old.generatedLessons ?? {},
    outlines: old.importedOutline?.length || old.outlineAdditions?.length ? {
      [old.subject]: [...(old.importedOutline ?? []), ...(old.outlineAdditions ?? []).map((title: string, index: number) =>
        ({ id: 'legacy-chapter-' + index, title, children: [] }))],
    } : {},
    notes: Object.fromEntries(subjects.map(({ id }) => [id, (old.notes ?? [])
      .filter((note: { subject: Subject }) => note.subject === id)
      .map((note: { text: string }) => note.text)])),
    attempts: Object.entries(old.quizSubmitted ?? {}).flatMap(([lesson, value]) => {
      const block = (old.generatedLessons?.[lesson] as Lesson | undefined ?? lessons.get(lesson))
        ?.blocks.find((item: Block) => item.type === 'assessment')
      return block ? [{ lesson, block: block.id, ...(value as Pick<Attempt, 'choice' | 'correct' | 'date'>) }] : []
    }),
    runs: { 'physics/lab': (old.labRecords ?? []).map((item: {
      speed: number; height: number; gravity: number; flight: string; range: string; createdAt: string
    }) => ({
      parameters: { speed: item.speed, height: item.height, gravity: item.gravity },
      flight: Number(item.flight), range: Number(item.range), date: item.createdAt,
    })) },
  }
}

export function writeLocal(data: LocalData) {
  localStorage.setItem(storageKey, JSON.stringify(data))
}

export function findNode(nodes: OutlineNode[], id: string): OutlineNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    const match = findNode(node.children, id)
    if (match) return match
  }
}

export function draftId(node: OutlineNode, subject: Subject) {
  return node.lessonId ?? subject + '-' + node.id
}

export function knowledgeTitle(id: string) {
  function find(nodes: OutlineNode[]): string | undefined {
    for (const node of nodes) {
      const title = node.knowledgePoints?.find((point) => point.id === id)?.title ?? find(node.children)
      if (title) return title
    }
  }
  return find(seedOutline) ?? id
}

export function useTemplate(lesson: Lesson, title: string, grade: string): Lesson {
  return { ...structuredClone(lesson), title, grade, version: '1.0.1-template-draft', generation_mode: 'template' }
}

export async function request<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/' + path, body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  } : { signal })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('教材服务不可用')
  }
  const data = await response.json()
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `请求失败（${response.status}）`)
  return data
}

export async function importDocument(file: File) {
  if (file.size > 8_000_000) throw new Error('大纲文件不得超过 8 MB')
  if (/\.(?:md|txt)$/i.test(file.name)) return file.text()
  const response = await fetch('/api/studio/extract-outline?filename=' + encodeURIComponent(file.name), {
    method: 'POST', body: file,
  })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('请启动教材服务后导入文档')
  const result = await response.json()
  if (!response.ok) throw new Error(result.detail)
  return result.text as string
}

export function transformNode(nodes: OutlineNode[], id: string, edit: (node: OutlineNode) => OutlineNode | null): OutlineNode[] {
  return nodes.flatMap((node) => {
    if (node.id === id) {
      const edited = edit(node)
      return edited ? [edited] : []
    }
    return [{ ...node, children: transformNode(node.children, id, edit) }]
  })
}

export function reorderNode(nodes: OutlineNode[], id: string, delta: number): OutlineNode[] {
  const index = nodes.findIndex((node) => node.id === id)
  if (index === -1) return nodes.map((node) => ({ ...node, children: reorderNode(node.children, id, delta) }))
  const other = index + delta
  if (other < 0 || other >= nodes.length) return nodes
  const ordered = [...nodes]
  ;[ordered[index], ordered[other]] = [ordered[other], ordered[index]]
  return ordered
}

export function moveNode(nodes: OutlineNode[], id: string, target: string) {
  const moving = findNode(nodes, id)
  if (!moving || id === target || (target && !findNode(nodes, target)) || findNode(moving.children, target)) {
    throw new Error('无法将节点移动到自身或下级节点')
  }
  const detached = transformNode(nodes, id, () => null)
  const moved = target ? transformNode(detached, target, (node) => ({
    ...node, children: [...node.children, moving],
  })) : [...detached, moving]
  function depth(items: OutlineNode[]): number {
    return items.length ? 1 + Math.max(...items.map((node) => depth(node.children))) : 0
  }
  if (depth(moved) > 6) throw new Error('大纲最多六级')
  return moved
}
